// Package events owns staff event records and explicit calendar delivery.
package events

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"
	"unicode"
	"unicode/utf8"
)

const Timezone = "America/New_York"
const ClubCalendarID = "f64u131to44gn3tn8g62ov2u1s@group.calendar.google.com"
const PageSize = 25

var (
	ErrInvalid   = errors.New("invalid event fields")
	ErrTime      = errors.New("invalid or ambiguous New York time")
	ErrNotFound  = errors.New("event not found")
	ErrConflict  = errors.New("event has changed")
	ErrCancelled = errors.New("event is cancelled")
	ErrForbidden = errors.New("staff access required")
	ErrDisabled  = errors.New("calendar integration disabled")
	ErrCalendar  = errors.New("calendar sync failed")
	ErrGone      = errors.New("calendar event was deleted")
	uuidPattern  = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	newYork, _   = time.LoadLocation(Timezone)
)

type Input struct {
	Title       string    `json:"title"`
	Location    string    `json:"location"`
	Description string    `json:"description"`
	Start       string    `json:"start"`
	End         string    `json:"end"`
	Version     int       `json:"version"`
	StartsAt    time.Time `json:"-"`
	EndsAt      time.Time `json:"-"`
}

// Wall-clock values are always interpreted in New York, never in the browser's
// zone. Reject skipped/repeated DST minutes instead of silently choosing an hour.
func parseTime(value string) (time.Time, error) {
	const layout = "2006-01-02T15:04"
	t, err := time.ParseInLocation(layout, value, newYork)
	if err != nil || t.Format(layout) != value || t.Year() < 2000 || t.Year() > 2100 {
		return time.Time{}, ErrTime
	}
	if t.Add(time.Hour).In(newYork).Format(layout) == value || t.Add(-time.Hour).In(newYork).Format(layout) == value {
		return time.Time{}, ErrTime
	}
	return t.UTC(), nil
}

func (input *Input) Validate() error {
	input.Title = strings.TrimSpace(input.Title)
	input.Location = strings.TrimSpace(input.Location)
	input.Description = strings.TrimSpace(strings.ReplaceAll(input.Description, "\r\n", "\n"))
	for _, field := range []struct {
		value               string
		limit               int
		required, multiline bool
	}{
		{input.Title, 200, true, false}, {input.Location, 500, true, false}, {input.Description, 5000, false, true},
	} {
		if !utf8.ValidString(field.value) || utf8.RuneCountInString(field.value) > field.limit || (field.required && field.value == "") ||
			strings.ContainsFunc(field.value, func(r rune) bool { return unicode.IsControl(r) && !(field.multiline && (r == '\n' || r == '\t')) }) {
			return ErrInvalid
		}
	}
	if input.Version < 0 || input.Version > 2147483646 {
		return ErrInvalid
	}
	var err error
	input.StartsAt, err = parseTime(input.Start)
	if err != nil {
		return err
	}
	input.EndsAt, err = parseTime(input.End)
	if err != nil {
		return err
	}
	if !input.EndsAt.After(input.StartsAt) {
		return ErrTime
	}
	return nil
}

type Event struct {
	ID              string     `json:"id"`
	Title           string     `json:"title"`
	Location        string     `json:"location"`
	Description     string     `json:"description"`
	StartsAt        time.Time  `json:"startsAt"`
	EndsAt          time.Time  `json:"endsAt"`
	Timezone        string     `json:"timezone"`
	Status          string     `json:"status"`
	Version         int        `json:"version"`
	CreatedBy       string     `json:"createdBy"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
	CalendarID      string     `json:"calendarId"`
	CalendarEventID string     `json:"calendarEventId"`
	CalendarURL     string     `json:"calendarUrl"`
	SyncStatus      string     `json:"syncStatus"`
	SyncError       string     `json:"syncError"`
	SyncedAt        *time.Time `json:"syncedAt"`
	AttendanceURL   string     `json:"attendanceUrl,omitempty"`
}

func (e Event) matches(input Input) bool {
	return e.Title == input.Title && e.Location == input.Location && e.Description == input.Description &&
		e.StartsAt.Equal(input.StartsAt) && e.EndsAt.Equal(input.EndsAt)
}

type Page struct {
	Events          []Event `json:"events"`
	Page            int     `json:"page"`
	PageSize        int     `json:"pageSize"`
	HasMore         bool    `json:"hasMore"`
	CalendarEnabled bool    `json:"calendarEnabled"`
}

type Audit struct {
	ID        int64     `json:"id"`
	ActorID   string    `json:"actorId"`
	ActorName string    `json:"actorName"`
	Action    string    `json:"action"`
	Snapshot  Event     `json:"snapshot"`
	CreatedAt time.Time `json:"createdAt"`
}

type History struct {
	Entries []Audit `json:"entries"`
	HasMore bool    `json:"hasMore"`
}

func ParsePage(raw string) (int, error) {
	if raw == "" {
		return 1, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 || n > 10000 {
		return 0, ErrInvalid
	}
	return n, nil
}
