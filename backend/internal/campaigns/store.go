package campaigns

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
	"time"
)

type Store struct {
	// Non-nil only in integration tests: workers must never consume another fixture's or developer's queued campaign. Nil is the normal production dispatcher.
	dispatchScope []string
	DB            *pgxpool.Pool
	Transport     Transport
	PublicURL     string
	TopicARN      string
}

func jsonBytes(v any) []byte { b, _ := json.Marshal(v); return b }
func dbError(e error) error {
	if errors.Is(e, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return e
}
func (s *Store) staffTx(ctx context.Context, actor string) (pgx.Tx, error) {
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return nil, e
	}
	if _, e = tx.Exec(ctx, `select pg_advisory_xact_lock_shared(hashtext('csc.role_changes'))`); e == nil {
		var ok bool
		e = tx.QueryRow(ctx, `select exists(select 1 from csc.profiles p join auth.users u on u.id=p.auth_user_id join csc.user_roles r on r.auth_user_id=u.id and r.role='staff' where u.id=$1::uuid and p.account_status='active' and p.first_name is not null and p.last_name is not null and p.graduation_year is not null and cardinality(p.majors)>0 and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()))`, actor).Scan(&ok)
		if e == nil && !ok {
			e = ErrBlocked
		}
	}
	if e != nil {
		_ = tx.Rollback(ctx)
		return nil, e
	}
	return tx, nil
}

const contactSelect = `select c.id::text,c.email,c.auth_user_id::text,c.first_name,c.last_name,c.graduation_year,c.majors,c.tags,c.subscribed,c.archived,c.blocked_reason,c.version,c.token,
 array(select role from csc.user_roles where auth_user_id=c.auth_user_id order by role),array(select event_id::text from csc.attendance where auth_user_id=c.auth_user_id),
 (c.auth_user_id is null or (p.account_status='active' and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()))) from csc.email_contacts c left join csc.profiles p on p.auth_user_id=c.auth_user_id left join auth.users u on u.id=c.auth_user_id`

func scanContact(row pgx.Row) (c Contact, e error) {
	e = row.Scan(&c.ID, &c.Email, &c.UserID, &c.FirstName, &c.LastName, &c.Year, &c.Majors, &c.Tags, &c.Subscribed, &c.Archived, &c.Blocked, &c.Version, &c.Token, &c.Roles, &c.Attendance, &c.Active)
	return c, dbError(e)
}
func (s *Store) Contacts(ctx context.Context) ([]Contact, error) {
	rows, e := s.DB.Query(ctx, contactSelect+` order by c.last_name,c.first_name,c.email`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Contact{}
	for rows.Next() {
		c, e := scanContact(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
func (s *Store) SaveContact(ctx context.Context, actor, id string, in ContactInput) (Contact, error) {
	if e := in.Validate(); e != nil {
		return Contact{}, e
	}
	if id != "new" && !ValidID(id) {
		return Contact{}, ErrInvalid
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return Contact{}, e
	}
	defer tx.Rollback(ctx)
	if in.FirstName == "" || in.LastName == "" {
		if id == "new" {
			return Contact{}, ErrInvalid
		}
		var linked bool
		if e := tx.QueryRow(ctx, `select auth_user_id is not null from csc.email_contacts where id=$1::uuid`, id).Scan(&linked); e != nil {
			return Contact{}, dbError(e)
		}
		if !linked {
			return Contact{}, ErrInvalid
		}
	}
	if id == "new" {
		if in.Version != 0 {
			return Contact{}, ErrInvalid
		}
		e = tx.QueryRow(ctx, `insert into csc.email_contacts(email,first_name,last_name,graduation_year,majors,tags,archived) values($1,$2,$3,$4,$5,$6,$7) on conflict(email) do nothing returning id::text`, in.Email, in.FirstName, in.LastName, in.Year, in.Majors, in.Tags, in.Archived).Scan(&id)
		if errors.Is(e, pgx.ErrNoRows) {
			return Contact{}, ErrConflict
		}
	} else {
		tag, err := tx.Exec(ctx, `update csc.email_contacts set first_name=case when auth_user_id is null then $3 else first_name end,last_name=case when auth_user_id is null then $4 else last_name end,graduation_year=case when auth_user_id is null then $5 else graduation_year end,majors=case when auth_user_id is null then $6 else majors end,tags=$7,archived=$8,version=version+1,updated_at=now() where id=$1::uuid and version=$2 and email=$9`, id, in.Version, in.FirstName, in.LastName, in.Year, in.Majors, in.Tags, in.Archived, in.Email)
		e = err
		if e == nil && tag.RowsAffected() != 1 {
			return Contact{}, ErrConflict
		}
	}
	if e != nil {
		return Contact{}, e
	}
	if _, e = tx.Exec(ctx, `insert into csc.email_history(actor_id,action,snapshot) values($1::uuid,'contact_saved',$2)`, actor, jsonBytes(map[string]string{"contactId": id})); e != nil {
		return Contact{}, e
	}
	c, e := scanContact(tx.QueryRow(ctx, contactSelect+` where c.id=$1::uuid`, id))
	if e != nil {
		return c, e
	}
	return c, tx.Commit(ctx)
}
func (s *Store) BulkTags(ctx context.Context, actor string, ids, tags []string, remove bool) error {
	if len(ids) == 0 || len(ids) > 5000 {
		return ErrInvalid
	}
	for _, id := range ids {
		if !ValidID(id) {
			return ErrInvalid
		}
	}
	tags, e := labels(tags, 50)
	if e != nil {
		return e
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	_, e = tx.Exec(ctx, `update csc.email_contacts set tags=array(select distinct t from unnest(case when $3 then tags else tags || $2::text[] end) t where not $3 or not t=any($2::text[])),version=version+1,updated_at=now() where id=any($1::uuid[])`, ids, tags, remove)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (s *Store) Subscription(ctx context.Context, user string) (Contact, error) {
	return scanContact(s.DB.QueryRow(ctx, contactSelect+` where c.auth_user_id=$1::uuid`, user))
}
func (s *Store) SetSubscription(ctx context.Context, user string, on bool) (Contact, error) {
	if !on {
		c, e := s.Subscription(ctx, user)
		if e != nil {
			return Contact{}, e
		}
		if e = s.Unsubscribe(ctx, c.Token); e != nil {
			return Contact{}, e
		}
		return s.Subscription(ctx, user)
	}
	_, e := s.DB.Exec(ctx, `update csc.email_contacts set subscribed=$2,version=version+1,updated_at=now() where auth_user_id=$1::uuid`, user, on)
	if e != nil {
		return Contact{}, e
	}
	return s.Subscription(ctx, user)
}
func (s *Store) ByToken(ctx context.Context, token string) (Contact, error) {
	if len(token) != 64 {
		return Contact{}, ErrNotFound
	}
	return scanContact(s.DB.QueryRow(ctx, contactSelect+` where c.token=$1`, token))
}
func (s *Store) Unsubscribe(ctx context.Context, token string, campaign ...string) error {
	campaignID := ""
	if len(campaign) > 0 && campaign[0] != "" {
		campaignID = campaign[0]
		if !ValidID(campaignID) {
			return ErrInvalid
		}
	}

	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var id string
	e = tx.QueryRow(ctx, `update csc.email_contacts set subscribed=false,version=version+1,updated_at=now() where token=$1 and subscribed returning id::text`, token).Scan(&id)
	if errors.Is(e, pgx.ErrNoRows) {
		var exists bool
		e = tx.QueryRow(ctx, `select exists(select 1 from csc.email_contacts where token=$1)`, token).Scan(&exists)
		if e != nil {
			return e
		}
		if !exists {
			return ErrNotFound
		}
		return nil
	}
	if e != nil {
		return e
	}
	_, e = tx.Exec(ctx, `insert into csc.email_events(provider_id,campaign_id,recipient_id,kind) select 'unsubscribe:'||r.campaign_id::text||':'||$1,r.campaign_id,r.id,'unsubscribe' from csc.email_recipients r where r.contact_id=$2::uuid and not r.is_test and r.status in ('accepted','uncertain') and ($3='' or r.campaign_id=nullif($3,'')::uuid) order by r.submitted_at desc nulls last limit 1 on conflict(provider_id) do nothing`, token, id, campaignID)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}

const draftSelect = `select d.id::text,d.name,d.subject,d.preheader,d.blocks,d.audience,d.status,d.version,d.scheduled_at,d.updated_at,d.updated_by::text,coalesce(nullif(trim(concat(p.first_name,' ',p.last_name)),''),'CSC officer') from csc.email_campaigns d left join csc.profiles p on p.auth_user_id=d.updated_by`

func scanDraft(row pgx.Row) (d Draft, e error) {
	var bs, as []byte
	e = row.Scan(&d.ID, &d.Name, &d.Subject, &d.Preheader, &bs, &as, &d.Status, &d.Version, &d.ScheduledAt, &d.UpdatedAt, &d.UpdatedBy, &d.EditorName)
	if e == nil {
		e = json.Unmarshal(bs, &d.Blocks)
	}
	if e == nil {
		e = json.Unmarshal(as, &d.Audience)
	}
	return d, dbError(e)
}
func (s *Store) Drafts(ctx context.Context) ([]Draft, error) {
	rows, e := s.DB.Query(ctx, draftSelect+` order by d.updated_at desc`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Draft{}
	for rows.Next() {
		d, e := scanDraft(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
func (s *Store) Draft(ctx context.Context, id string) (Draft, error) {
	if !ValidID(id) {
		return Draft{}, ErrInvalid
	}
	return scanDraft(s.DB.QueryRow(ctx, draftSelect+` where d.id=$1::uuid`, id))
}
func (s *Store) SaveDraft(ctx context.Context, actor, id string, in DraftInput) (Draft, error) {
	if e := in.Validate(); e != nil {
		return Draft{}, e
	}
	if id != "new" && !ValidID(id) {
		return Draft{}, ErrInvalid
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return Draft{}, e
	}
	defer tx.Rollback(ctx)
	if in.Version == 0 {
		if id == "new" {
			return Draft{}, ErrInvalid
		}
		tag, err := tx.Exec(ctx, `insert into csc.email_campaigns(id,name,subject,preheader,blocks,audience,created_by,updated_by) values($1::uuid,$2,$3,$4,$5,$6,$7::uuid,$7::uuid) on conflict(id) do nothing`, id, in.Name, in.Subject, in.Preheader, jsonBytes(in.Blocks), jsonBytes(in.Audience), actor)
		e = err
		if e == nil && tag.RowsAffected() == 0 {
			d, err := scanDraft(tx.QueryRow(ctx, draftSelect+` where d.id=$1::uuid`, id))
			return d, err
		}

	} else {
		tag, err := tx.Exec(ctx, `update csc.email_campaigns set name=$3,subject=$4,preheader=$5,blocks=$6,audience=$7,updated_by=$8::uuid,updated_at=now(),version=version+1 where id=$1::uuid and version=$2 and status='draft'`, id, in.Version, in.Name, in.Subject, in.Preheader, jsonBytes(in.Blocks), jsonBytes(in.Audience), actor)
		e = err
		if e == nil && tag.RowsAffected() != 1 {
			return Draft{}, ErrConflict
		}
	}
	if e != nil {
		return Draft{}, e
	}
	_, e = tx.Exec(ctx, `insert into csc.email_history(campaign_id,actor_id,action,snapshot) values($1::uuid,$2::uuid,'draft_saved',$3)`, id, actor, jsonBytes(in))
	if e != nil {
		return Draft{}, e
	}
	d, e := scanDraft(tx.QueryRow(ctx, draftSelect+` where d.id=$1::uuid`, id))
	if e != nil {
		return d, e
	}
	return d, tx.Commit(ctx)
}
func (s *Store) Action(ctx context.Context, actor, id, action string, version int, at string) (Draft, error) {
	if !ValidID(id) || version < 1 {
		return Draft{}, ErrInvalid
	}
	var when any
	status := ""
	switch action {
	case "send", "schedule":
		if s.Transport == nil {
			return Draft{}, ErrDisabled
		}
		status = "scheduled"
		t := time.Now()
		if action == "schedule" {
			var e error
			t, e = ScheduleTime(at)
			if e != nil {
				return Draft{}, e
			}
		}
		when = t
	case "draft":
		status = "draft"
	case "cancel":
		status = "cancelled"
	default:
		return Draft{}, ErrInvalid
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return Draft{}, e
	}
	defer tx.Rollback(ctx)
	d, e := scanDraft(tx.QueryRow(ctx, draftSelect+` where d.id=$1::uuid for update of d`, id))
	if e != nil {
		return d, e
	}
	if d.Version != version {
		return d, ErrConflict
	}
	if (action == "send" || action == "schedule") && (d.Status != "draft" || strings.TrimSpace(d.Subject) == "" || len(d.Blocks) == 0 || !ReadyBlocks(d.Blocks)) {
		return d, ErrConflict
	}
	if action == "draft" && d.Status != "scheduled" {
		return d, ErrConflict
	}
	if action == "cancel" && d.Status != "scheduled" && d.Status != "sending" && d.Status != "attention" {
		return d, ErrConflict
	}
	_, e = tx.Exec(ctx, `update csc.email_campaigns set status=$2,scheduled_at=$3,updated_by=$4::uuid,version=version+1,updated_at=now() where id=$1::uuid`, id, status, when, actor)
	if e != nil {
		return d, e
	}
	if action == "cancel" {
		_, e = tx.Exec(ctx, `update csc.email_recipients set status='skipped',reason='Campaign cancelled' where campaign_id=$1::uuid and status='pending'`, id)
		if e != nil {
			return d, e
		}
	}
	_, e = tx.Exec(ctx, `insert into csc.email_history(campaign_id,actor_id,action,snapshot) values($1::uuid,$2::uuid,$3,$4)`, id, actor, action, jsonBytes(d))
	if e != nil {
		return d, e
	}
	d, e = scanDraft(tx.QueryRow(ctx, draftSelect+` where d.id=$1::uuid`, id))
	if e != nil {
		return d, e
	}
	return d, tx.Commit(ctx)
}

type Saved struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Rules  Audience `json:"rules"`
	Blocks []Block  `json:"blocks"`
}

func (s *Store) Library(ctx context.Context, kind string) ([]Saved, error) {
	table := "email_templates"
	field := "blocks"
	if kind == "audiences" {
		table = "email_audiences"
		field = "rules"
	}
	rows, e := s.DB.Query(ctx, `select id::text,name,`+field+` from csc.`+table+` order by name`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Saved{}
	for rows.Next() {
		var v Saved
		var b []byte
		if e = rows.Scan(&v.ID, &v.Name, &b); e != nil {
			return nil, e
		}
		if kind == "audiences" {
			e = json.Unmarshal(b, &v.Rules)
		} else {
			e = json.Unmarshal(b, &v.Blocks)
		}
		if e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s *Store) SaveLibrary(ctx context.Context, actor, kind string, v Saved) error {
	if strings.TrimSpace(v.Name) == "" || !validText(v.Name, 200, false) {
		return ErrInvalid
	}
	table, field := "email_templates", "blocks"
	var data any = v.Blocks
	if kind == "audiences" {
		table, field = "email_audiences", "rules"
		data = v.Rules
		if e := v.Rules.Validate(); e != nil {
			return e
		}
	} else if e := ValidateBlocks(v.Blocks); e != nil {
		return e
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	_, e = tx.Exec(ctx, `insert into csc.`+table+`(name,`+field+`,updated_by) values($1,$2,$3::uuid) on conflict(name) do update set `+field+`=excluded.`+field+`,updated_by=excluded.updated_by,updated_at=now()`, strings.TrimSpace(v.Name), jsonBytes(data), actor)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
