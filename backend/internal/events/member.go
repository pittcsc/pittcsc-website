package events

import (
	"context"
	"time"
)

// MemberEvent contains only the details shown to signed-in members. Staff
// delivery, creator, and audit fields never enter this response.
type MemberEvent struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Location    string    `json:"location"`
	Description string    `json:"description"`
	StartsAt    time.Time `json:"startsAt"`
	EndsAt      time.Time `json:"endsAt"`
}

type MemberEvents struct {
	Events []MemberEvent `json:"events"`
}

func (s Store) ListUpcoming(ctx context.Context) (MemberEvents, error) {
	rows, err := s.DB.Query(ctx, `select id::text, title, location, description, starts_at, ends_at
		from csc.events
		where status = 'active' and ends_at > now()
		order by starts_at > now(), starts_at, id
		limit 3`)
	if err != nil {
		return MemberEvents{}, err
	}
	defer rows.Close()
	result := MemberEvents{Events: []MemberEvent{}}
	for rows.Next() {
		var event MemberEvent
		if err := rows.Scan(&event.ID, &event.Title, &event.Location, &event.Description, &event.StartsAt, &event.EndsAt); err != nil {
			return MemberEvents{}, err
		}
		event.StartsAt = event.StartsAt.UTC()
		event.EndsAt = event.EndsAt.UTC()
		result.Events = append(result.Events, event)
	}
	return result, rows.Err()
}
