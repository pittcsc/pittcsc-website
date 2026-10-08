package events

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type CheckInStatus struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Status      string     `json:"status"`
	CheckedInAt *time.Time `json:"checkedInAt"`
}

type Attendee struct {
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	CheckedInAt time.Time `json:"checkedInAt"`
}

type AttendancePage struct {
	Attendees []Attendee `json:"attendees"`
	Count     int        `json:"count"`
	Page      int        `json:"page"`
	HasMore   bool       `json:"hasMore"`
}

// CheckInStatus reads only the requested event and the current user's own row.
func (s Store) CheckInStatus(ctx context.Context, userID, eventID string) (CheckInStatus, error) {
	if !uuidPattern.MatchString(eventID) {
		return CheckInStatus{}, ErrNotFound
	}
	var result CheckInStatus
	err := s.DB.QueryRow(ctx, `select e.id::text, e.title, e.status, a.checked_in_at
		from csc.events e left join csc.attendance a
		on a.event_id = e.id and a.auth_user_id = $2::uuid
		where e.id = $1::uuid`, eventID, userID).
		Scan(&result.ID, &result.Title, &result.Status, &result.CheckedInAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return CheckInStatus{}, ErrNotFound
	}
	return result, err
}

// CheckIn locks the event and profile until commit. Cancellation and suspension
// cannot slip between the status checks and insert, even across API instances.
func (s Store) CheckIn(ctx context.Context, userID, eventID string) (CheckInStatus, error) {
	if !uuidPattern.MatchString(eventID) {
		return CheckInStatus{}, ErrNotFound
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return CheckInStatus{}, err
	}
	defer tx.Rollback(ctx)
	var result CheckInStatus
	err = tx.QueryRow(ctx, `select id::text, title, status from csc.events
		where id = $1::uuid for share`, eventID).
		Scan(&result.ID, &result.Title, &result.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return CheckInStatus{}, ErrNotFound
	}
	if err != nil {
		return CheckInStatus{}, err
	}
	if result.Status != "active" {
		return CheckInStatus{}, ErrCancelled
	}
	var profileID string
	err = tx.QueryRow(ctx, `select id::text from csc.profiles
		where auth_user_id = $1::uuid and account_status = 'active' for share`, userID).Scan(&profileID)
	if errors.Is(err, pgx.ErrNoRows) {
		return CheckInStatus{}, profile.ErrSuspended
	}
	if err != nil {
		return CheckInStatus{}, err
	}
	_, err = tx.Exec(ctx, `insert into csc.attendance (event_id, auth_user_id)
		values ($1::uuid, $2::uuid) on conflict do nothing`, eventID, userID)
	if err != nil {
		return CheckInStatus{}, err
	}
	err = tx.QueryRow(ctx, `select checked_in_at from csc.attendance
		where event_id = $1::uuid and auth_user_id = $2::uuid`, eventID, userID).Scan(&result.CheckedInAt)
	if err != nil {
		return CheckInStatus{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CheckInStatus{}, err
	}
	return result, nil
}

func (s Store) Attendance(ctx context.Context, eventID string, page int) (AttendancePage, error) {
	if !uuidPattern.MatchString(eventID) {
		return AttendancePage{}, ErrNotFound
	}
	if page < 1 || page > 10000 {
		return AttendancePage{}, ErrInvalid
	}
	result := AttendancePage{Attendees: []Attendee{}, Page: page}
	err := s.DB.QueryRow(ctx, `select (select count(*) from csc.attendance where event_id = $1::uuid)
		from csc.events where id = $1::uuid`, eventID).Scan(&result.Count)
	if errors.Is(err, pgx.ErrNoRows) {
		return AttendancePage{}, ErrNotFound
	}
	if err != nil {
		return AttendancePage{}, err
	}
	rows, err := s.DB.Query(ctx, `select coalesce(nullif(concat_ws(' ', coalesce(p.preferred_name, p.first_name), p.last_name), ''), ''),
		coalesce(u.email, ''), a.checked_in_at from csc.attendance a
		join csc.profiles p on p.auth_user_id = a.auth_user_id
		join auth.users u on u.id = a.auth_user_id
		where a.event_id = $1::uuid
		order by a.checked_in_at desc, a.auth_user_id
		limit $2 offset $3`, eventID, PageSize+1, (page-1)*PageSize)
	if err != nil {
		return AttendancePage{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var attendee Attendee
		if err := rows.Scan(&attendee.Name, &attendee.Email, &attendee.CheckedInAt); err != nil {
			return AttendancePage{}, err
		}
		result.Attendees = append(result.Attendees, attendee)
	}
	if err := rows.Err(); err != nil {
		return AttendancePage{}, err
	}
	if len(result.Attendees) > PageSize {
		result.Attendees = result.Attendees[:PageSize]
		result.HasMore = true
	}
	return result, nil
}
