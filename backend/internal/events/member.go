package events

import (
	"context"
	"time"
)

// MemberEvent contains only the details shown to signed-in members. Staff
// delivery, creator, and audit fields never enter this response.
type MemberEvent struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Location     string    `json:"location"`
	Description  string    `json:"description"`
	StartsAt     time.Time `json:"startsAt"`
	EndsAt       time.Time `json:"endsAt"`
	FoundryEvent bool      `json:"foundryEvent"`
	Eligible     bool      `json:"eligible"`
}

type MemberEvents struct {
	Events []MemberEvent `json:"events"`
}

func (s Store) ListUpcoming(ctx context.Context, userID string) (MemberEvents, error) {
	rows, err := s.DB.Query(ctx, `select id::text, title, location, description, starts_at, ends_at, foundry_event
		from csc.events
		where status = 'active' and ends_at > now()
		order by starts_at > now(), starts_at, id
		limit 3`)
	if err != nil {
		return MemberEvents{}, err
	}
	defer rows.Close()
	result := MemberEvents{Events: []MemberEvent{}}
	hasFoundryEvent := false
	for rows.Next() {
		var event MemberEvent
		if err := rows.Scan(&event.ID, &event.Title, &event.Location, &event.Description, &event.StartsAt, &event.EndsAt, &event.FoundryEvent); err != nil {
			return MemberEvents{}, err
		}
		event.StartsAt = event.StartsAt.UTC()
		event.EndsAt = event.EndsAt.UTC()
		event.Eligible = !event.FoundryEvent
		hasFoundryEvent = hasFoundryEvent || event.FoundryEvent
		result.Events = append(result.Events, event)
	}
	if err := rows.Err(); err != nil {
		return MemberEvents{}, err
	}
	rows.Close()
	if hasFoundryEvent {
		access, err := foundryAccess(ctx, s.DB, userID)
		if err != nil {
			return MemberEvents{}, err
		}
		for i := range result.Events {
			if result.Events[i].FoundryEvent {
				result.Events[i].Eligible = access
			}
		}
	}
	return result, nil
}
