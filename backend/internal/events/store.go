package events

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Calendar interface {
	Upsert(context.Context, Event) (string, error)
	Remove(context.Context, Event) error
}

type Store struct {
	DB         *pgxpool.Pool
	Calendar   Calendar
	CalendarID string
}

const columns = `id::text, title, location, description, starts_at, ends_at, timezone,
	status, version, created_by::text, created_at, updated_at, calendar_id,
	calendar_event_id, calendar_url, sync_status, sync_error, synced_at`

func scanEvent(row pgx.Row) (Event, error) {
	var e Event
	err := row.Scan(&e.ID, &e.Title, &e.Location, &e.Description, &e.StartsAt, &e.EndsAt, &e.Timezone,
		&e.Status, &e.Version, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt, &e.CalendarID,
		&e.CalendarEventID, &e.CalendarURL, &e.SyncStatus, &e.SyncError, &e.SyncedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Event{}, ErrNotFound
	}
	e.StartsAt, e.EndsAt = e.StartsAt.UTC(), e.EndsAt.UTC()
	e.CreatedAt, e.UpdatedAt = e.CreatedAt.UTC(), e.UpdatedAt.UTC()
	if e.SyncedAt != nil {
		utc := e.SyncedAt.UTC()
		e.SyncedAt = &utc
	}
	return e, err
}

func (s Store) List(ctx context.Context, filter string, page int) (Page, error) {
	if filter == "" {
		filter = "upcoming"
	}
	if page < 1 || page > 10000 || (filter != "upcoming" && filter != "past" && filter != "cancelled" && filter != "all") {
		return Page{}, ErrInvalid
	}
	rows, err := s.DB.Query(ctx, `select `+columns+` from csc.events
		where ($1 = 'all' or ($1 = 'cancelled' and status = 'cancelled')
		or ($1 = 'upcoming' and status = 'active' and ends_at >= now())
		or ($1 = 'past' and status = 'active' and ends_at < now()))
		order by case when $1 = 'upcoming' then starts_at end asc,
		case when $1 <> 'upcoming' then starts_at end desc, id
		limit $2 offset $3`, filter, PageSize+1, (page-1)*PageSize)
	if err != nil {
		return Page{}, err
	}
	defer rows.Close()
	result := Page{Events: []Event{}, Page: page, PageSize: PageSize, CalendarEnabled: s.Calendar != nil}
	for rows.Next() {
		e, err := scanEvent(rows)
		if err != nil {
			return Page{}, err
		}
		result.Events = append(result.Events, e)
	}
	if len(result.Events) > PageSize {
		result.HasMore = true
		result.Events = result.Events[:PageSize]
	}
	return result, rows.Err()
}

func (s Store) Get(ctx context.Context, id string) (Event, error) {
	if !uuidPattern.MatchString(id) {
		return Event{}, ErrNotFound
	}
	return scanEvent(s.DB.QueryRow(ctx, `select `+columns+` from csc.events where id = $1::uuid`, id))
}

func (s Store) History(ctx context.Context, id string, before int64) (History, error) {
	if !uuidPattern.MatchString(id) {
		return History{}, ErrNotFound
	}
	if before < 0 {
		return History{}, ErrInvalid
	}
	if _, err := s.Get(ctx, id); err != nil {
		return History{}, err
	}
	rows, err := s.DB.Query(ctx, `select a.id, a.actor_user_id::text,
		coalesce(nullif(concat_ws(' ', coalesce(p.preferred_name, p.first_name), p.last_name), ''), 'Staff member'),
		a.action, a.snapshot, a.created_at from csc.event_audit a
		left join csc.profiles p on p.auth_user_id = a.actor_user_id
		where a.event_id = $1::uuid and ($2::bigint = 0 or a.id < $2)
		order by a.id desc limit 26`, id, before)
	if err != nil {
		return History{}, err
	}
	defer rows.Close()
	h := History{Entries: []Audit{}}
	for rows.Next() {
		var a Audit
		var snapshot []byte
		if err := rows.Scan(&a.ID, &a.ActorID, &a.ActorName, &a.Action, &snapshot, &a.CreatedAt); err != nil {
			return History{}, err
		}
		if err := json.Unmarshal(snapshot, &a.Snapshot); err != nil {
			return History{}, err
		}
		h.Entries = append(h.Entries, a)
	}
	if len(h.Entries) > 25 {
		h.HasMore = true
		h.Entries = h.Entries[:25]
	}
	return h, rows.Err()
}

// A session advisory lock serializes saves, cancellation, and Google calls for
// this event across all API instances, while letting the CRM transaction commit
// before any external work. A connection is never returned to the pool locked.
func (s Store) lock(ctx context.Context, id string) (*pgxpool.Conn, func(), error) {
	if !uuidPattern.MatchString(id) {
		return nil, nil, ErrNotFound
	}
	conn, err := s.DB.Acquire(ctx)
	if err != nil {
		return nil, nil, err
	}
	_, err = conn.Exec(ctx, `select pg_advisory_lock(hashtextextended($1, 164))`, id)
	if err != nil {
		// The server may have acquired the lock just before a cancelled response.
		_ = conn.Hijack().Close(context.Background())
		return nil, nil, err
	}
	release := func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		var unlocked bool
		err := conn.QueryRow(cleanup, `select pg_advisory_unlock(hashtextextended($1, 164))`, id).Scan(&unlocked)
		if err != nil || !unlocked {
			_ = conn.Hijack().Close(cleanup)
		} else {
			conn.Release()
		}
	}
	return conn, release, nil
}

func authorize(ctx context.Context, conn *pgxpool.Conn, actor string) error {
	var allowed bool
	err := conn.QueryRow(ctx, `select exists (
		select 1 from csc.profiles p join csc.user_roles r on r.auth_user_id = p.auth_user_id
		join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid and p.account_status = 'active' and r.role = 'staff'
		and u.email_confirmed_at is not null and u.deleted_at is null and not u.is_anonymous
		and (u.banned_until is null or u.banned_until <= now()))`, actor).Scan(&allowed)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func audit(ctx context.Context, tx pgx.Tx, e Event, actor, action string) error {
	data, err := json.Marshal(e)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `insert into csc.event_audit (event_id, actor_user_id, action, snapshot)
		values ($1::uuid, $2::uuid, $3, $4::jsonb)`, e.ID, actor, action, data)
	return err
}

// Save uses a client-generated event UUID for retry-safe creation and a version
// for optimistic editing. Only actual changes add a mutation audit record.
func (s Store) Save(ctx context.Context, actor, id string, input Input) (Event, error) {
	if err := input.Validate(); err != nil {
		return Event{}, err
	}
	conn, release, err := s.lock(ctx, id)
	if err != nil {
		return Event{}, err
	}
	defer release()
	if err := authorize(ctx, conn, actor); err != nil {
		return Event{}, err
	}
	tx, err := conn.Begin(ctx)
	if err != nil {
		return Event{}, err
	}
	defer tx.Rollback(context.Background())
	e, err := scanEvent(tx.QueryRow(ctx, `select `+columns+` from csc.events where id = $1::uuid`, id))
	action := ""
	if errors.Is(err, ErrNotFound) {
		if input.Version != 0 {
			return Event{}, ErrNotFound
		}
		calendarID := s.CalendarID
		if calendarID == "" {
			calendarID = ClubCalendarID
		}
		e, err = scanEvent(tx.QueryRow(ctx, `insert into csc.events
			(id, title, location, description, starts_at, ends_at, created_by, calendar_id, calendar_event_id)
			values ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8, $9) returning `+columns,
			id, input.Title, input.Location, input.Description, input.StartsAt, input.EndsAt, actor, calendarID, "csc"+strings.ReplaceAll(id, "-", "")))
		action = "created"
	} else if err == nil {
		if e.Status == "cancelled" {
			return Event{}, ErrCancelled
		}
		if input.Version != e.Version && !(input.Version == e.Version-1 && e.matches(input)) {
			return Event{}, ErrConflict
		}
		if !e.matches(input) {
			e, err = scanEvent(tx.QueryRow(ctx, `update csc.events set title=$2, location=$3, description=$4,
				starts_at=$5, ends_at=$6, version=version+1, updated_at=now(), sync_status='pending', sync_error=''
				where id=$1::uuid returning `+columns, id, input.Title, input.Location, input.Description, input.StartsAt, input.EndsAt))
			action = "updated"
		}
	}
	if err != nil {
		return Event{}, err
	}
	if action != "" {
		if err := audit(ctx, tx, e, actor, action); err != nil {
			return Event{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Event{}, err
	}
	return s.sync(ctx, conn, actor, e), nil
}

func (s Store) Cancel(ctx context.Context, actor, id string, version int) (Event, error) {
	conn, release, err := s.lock(ctx, id)
	if err != nil {
		return Event{}, err
	}
	defer release()
	if err := authorize(ctx, conn, actor); err != nil {
		return Event{}, err
	}
	tx, err := conn.Begin(ctx)
	if err != nil {
		return Event{}, err
	}
	defer tx.Rollback(context.Background())
	e, err := scanEvent(tx.QueryRow(ctx, `select `+columns+` from csc.events where id=$1::uuid`, id))
	if err != nil {
		return Event{}, err
	}
	if e.Status != "cancelled" {
		if e.Version != version {
			return Event{}, ErrConflict
		}
		e, err = scanEvent(tx.QueryRow(ctx, `update csc.events set status='cancelled', version=version+1,
			updated_at=now(), sync_status='pending', sync_error='' where id=$1::uuid returning `+columns, id))
		if err != nil {
			return Event{}, err
		}
		if err := audit(ctx, tx, e, actor, "cancelled"); err != nil {
			return Event{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Event{}, err
	}
	return s.sync(ctx, conn, actor, e), nil
}

func (s Store) Sync(ctx context.Context, actor, id string) (Event, error) {
	conn, release, err := s.lock(ctx, id)
	if err != nil {
		return Event{}, err
	}
	defer release()
	if err := authorize(ctx, conn, actor); err != nil {
		return Event{}, err
	}
	e, err := scanEvent(conn.QueryRow(ctx, `select `+columns+` from csc.events where id=$1::uuid`, id))
	if err != nil {
		return Event{}, err
	}
	return s.sync(ctx, conn, actor, e), nil
}

func newCalendarEventID() string {
	var bytes [16]byte
	_, _ = rand.Read(bytes[:])
	return "csc" + hex.EncodeToString(bytes[:])
}

func (s Store) sync(ctx context.Context, conn *pgxpool.Conn, actor string, e Event) Event {
	// Persist pending even for a manual sync so interrupted processes are visible.
	_, err := conn.Exec(ctx, `update csc.events set sync_status='pending', sync_error='' where id=$1::uuid`, e.ID)
	e.SyncStatus, e.SyncError = "pending", "Calendar sync was interrupted. Sync again to confirm the calendar."
	if err != nil {
		return e
	}
	callCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	calendarURL := e.CalendarURL
	err = ErrDisabled
	if s.Calendar != nil {
		if e.Status == "cancelled" {
			err = s.Calendar.Remove(callCtx, e)
			if err == nil {
				calendarURL = ""
			}
		} else {
			calendarURL, err = s.Calendar.Upsert(callCtx, e)
			if errors.Is(err, ErrGone) {
				// A deleted Google ID can remain a tombstone. Persist its replacement
				// before insertion so timeouts/crashes always retry the same new ID.
				nextID := newCalendarEventID()
				_, err = conn.Exec(callCtx, `update csc.events set calendar_event_id=$2, calendar_url='', synced_at=null where id=$1::uuid`, e.ID, nextID)
				if err == nil {
					e.CalendarEventID, e.CalendarURL, e.SyncedAt = nextID, "", nil
					calendarURL, err = s.Calendar.Upsert(callCtx, e)
				}
			}
		}
	}
	status, message, action := "synced", "", "sync_succeeded"
	if errors.Is(err, ErrDisabled) {
		status, message, action = "disabled", "Google Calendar is not connected. The event is saved; staff can sync after setup.", "sync_disabled"
		if e.Status == "cancelled" {
			message = "Calendar removal is unavailable because Google Calendar is not connected. This event may still be publicly visible. Retry removal after setup."
		}
	} else if err != nil {
		status, message, action = "failed", "The event is saved, but Google Calendar could not be updated. Try Sync to Calendar again.", "sync_failed"
		if e.Status == "cancelled" {
			message = "Calendar removal failed. This cancelled event may still be publicly visible. Retry removal."
		}
	}
	// Record the attempt even if the browser disconnected. This is completion of
	// this explicit attempt, never a scheduled/background delivery retry.
	finishCtx, finishCancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
	defer finishCancel()
	tx, txErr := conn.Begin(finishCtx)
	if txErr != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	if err != nil {
		calendarURL = e.CalendarURL
	}
	updated, txErr := scanEvent(tx.QueryRow(finishCtx, `update csc.events set sync_status=$2, sync_error=$3,
		calendar_url=$4, synced_at=case when $2='synced' then now() else synced_at end
		where id=$1::uuid returning `+columns, e.ID, status, message, calendarURL))
	if txErr != nil {
		return e
	}
	if txErr = audit(finishCtx, tx, updated, actor, action); txErr != nil {
		return e
	}
	if txErr = tx.Commit(finishCtx); txErr != nil {
		return e
	}
	return updated
}
