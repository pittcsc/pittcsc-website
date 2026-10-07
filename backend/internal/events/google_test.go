package events

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func calendarFixture() Event {
	in := validInput()
	_ = in.Validate()
	return Event{ID: "00000000-0000-4000-8000-000000000164", Title: in.Title, Location: in.Location, Description: "Notes & <text>",
		StartsAt: in.StartsAt, EndsAt: in.EndsAt, CalendarID: "test@group.calendar.google.com", CalendarEventID: "csc000164"}
}

func TestGoogleCreateUpdateAndLostResponse(t *testing.T) {
	e := calendarFixture()
	var saved *googleEvent
	inserts, updates := 0, 0
	loseResponse := true
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, ClubCalendarID) {
			t.Error("test contacted club calendar")
		}
		switch r.Method {
		case "GET":
			if saved == nil {
				w.WriteHeader(404)
				return
			}
			_ = json.NewEncoder(w).Encode(saved)
		case "POST", "PUT":
			if r.URL.Query().Get("sendUpdates") != "none" {
				t.Error("invites must be disabled")
			}
			var body googleEvent
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Error(err)
			}
			if body.Start.TimeZone != Timezone || body.Start.DateTime != "2027-01-15T18:00:00-05:00" || body.ExtendedProperties["private"]["cscEventId"] != e.ID {
				t.Error("event fields missing")
			}
			body.HTMLLink = "https://www.google.com/calendar/event?eid=fixture"
			if r.Method == "POST" {
				inserts++
			} else {
				updates++
			}
			saved = &body
			if loseResponse {
				loseResponse = false
				w.WriteHeader(503)
				return
			}
			_ = json.NewEncoder(w).Encode(body)
		}
	}))
	defer api.Close()
	g := &GoogleCalendar{client: api.Client(), baseURL: api.URL}
	if _, err := g.Upsert(context.Background(), e); !errors.Is(err, ErrCalendar) {
		t.Fatal("lost response not surfaced")
	}
	if _, err := g.Upsert(context.Background(), e); err != nil {
		t.Fatal(err)
	}
	e.Title, e.Description = "Rescheduled", ""
	if _, err := g.Upsert(context.Background(), e); err != nil {
		t.Fatal(err)
	}
	if inserts != 1 || updates != 2 || saved.Summary != e.Title || saved.Description != "" {
		t.Fatal("retry duplicated event or edit not propagated")
	}
}

func TestGoogleDeletedCollisionAndFailures(t *testing.T) {
	for _, tc := range []struct {
		name      string
		codes     []int
		cancelled bool
		want      error
	}{
		{"deleted", []int{200}, true, ErrGone},
		{"gone", []int{410}, false, ErrGone},
		{"unresolved collision", []int{404, 409, 404}, false, ErrCalendar},
		{"lost insert conflict", []int{404, 409, 200, 200}, false, nil},
		{"access denied", []int{403}, false, ErrCalendar},
		{"quota", []int{429}, false, ErrCalendar},
		{"upstream error", []int{503}, false, ErrCalendar},
		{"insert denied", []int{404, 403}, false, ErrCalendar},
	} {
		t.Run(tc.name, func(t *testing.T) {
			n := 0
			api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if n >= len(tc.codes) {
					t.Error("unexpected automatic retry")
					w.WriteHeader(500)
					return
				}
				code := tc.codes[n]
				n++
				w.WriteHeader(code)
				state := "confirmed"
				if tc.cancelled {
					state = "cancelled"
				}
				_ = json.NewEncoder(w).Encode(googleEvent{ID: calendarFixture().CalendarEventID, Status: state, HTMLLink: "https://calendar.google.com/calendar/event?eid=test"})
			}))
			defer api.Close()
			g := &GoogleCalendar{client: api.Client(), baseURL: api.URL}
			_, err := g.Upsert(context.Background(), calendarFixture())
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v want %v", err, tc.want)
			}
		})
	}
}

func TestGoogleRemoveIdempotency(t *testing.T) {
	for _, code := range []int{204, 404, 410, 403, 503} {
		api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "GET" && code == 404 {
				_, _ = w.Write([]byte(`{"kind":"calendar#events"}`))
				return
			}
			if r.Method != "DELETE" {
				t.Error("removal must not create or update")
			}
			w.WriteHeader(code)
		}))
		g := &GoogleCalendar{client: api.Client(), baseURL: api.URL}
		err := g.Remove(context.Background(), calendarFixture())
		api.Close()
		if (err == nil) != (code == 204 || code == 404 || code == 410) {
			t.Fatalf("delete status %d: %v", code, err)
		}
	}
}

func TestMissingCalendarIsNotSuccessfulRemoval(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(404) }))
	defer api.Close()
	g := &GoogleCalendar{client: api.Client(), baseURL: api.URL}
	if err := g.Remove(context.Background(), calendarFixture()); !errors.Is(err, ErrCalendar) {
		t.Fatal("lost calendar access reported as successful removal")
	}
}

func TestCalendarURLAndCancellation(t *testing.T) {
	for _, raw := range []string{"javascript:alert(1)", "https://example.com/event", "https://calendar.google.com.evil.test/", "https://user@calendar.google.com/", "http://calendar.google.com/"} {
		if safeCalendarURL(raw) {
			t.Fatal("unsafe URL accepted")
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	g := &GoogleCalendar{client: &http.Client{}, baseURL: "http://127.0.0.1:1"}
	if _, err := g.Upsert(ctx, calendarFixture()); !errors.Is(err, ErrCalendar) {
		t.Fatal("cancelled request accepted")
	}
}
