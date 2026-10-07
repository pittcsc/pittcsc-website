package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/events"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type eventsStub struct {
	calls     int
	actor, id string
	input     events.Input
	err       error
}

func (s *eventsStub) List(context.Context, string, int) (events.Page, error) {
	s.calls++
	return events.Page{Events: []events.Event{}}, s.err
}
func (s *eventsStub) Get(context.Context, string) (events.Event, error) {
	s.calls++
	return events.Event{}, s.err
}
func (s *eventsStub) History(context.Context, string, int64) (events.History, error) {
	s.calls++
	return events.History{Entries: []events.Audit{}}, s.err
}
func (s *eventsStub) Save(_ context.Context, actor, id string, input events.Input) (events.Event, error) {
	s.calls++
	s.actor, s.id, s.input = actor, id, input
	return events.Event{ID: id, Title: input.Title, SyncStatus: "failed", SyncError: "Calendar sync failed."}, s.err
}
func (s *eventsStub) Cancel(_ context.Context, actor, id string, _ int) (events.Event, error) {
	s.calls++
	s.actor, s.id = actor, id
	return events.Event{Status: "cancelled"}, s.err
}
func (s *eventsStub) Sync(_ context.Context, actor, id string) (events.Event, error) {
	s.calls++
	s.actor, s.id = actor, id
	return events.Event{}, s.err
}

const validEventJSON = `{"title":"Workshop","location":"Room 101","start":"2027-01-15T18:00","end":"2027-01-15T19:00","version":0}`

func eventRequest(p *profilesStub, store eventStore, method, path, body, token string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), p, nil, store).ServeHTTP(w, r)
	return w
}

func TestEventsAuthorizeEveryOperation(t *testing.T) {
	for _, operation := range []struct{ method, path, body string }{
		{"GET", "/staff/events", ""}, {"GET", "/staff/events/test", ""}, {"GET", "/staff/events/test/history", ""},
		{"PUT", "/staff/events/test", validEventJSON}, {"POST", "/staff/events/test/cancel", `{"version":1}`}, {"POST", "/staff/events/test/sync", ""},
	} {
		for mask := 0; mask < 16; mask++ {
			assigned := []string{}
			for i, role := range []string{"member", "foundry", "staff", "alumni"} {
				if mask&(1<<i) != 0 {
					assigned = append(assigned, role)
				}
			}
			s := &eventsStub{}
			w := eventRequest(&profilesStub{roles: assigned}, s, operation.method, operation.path+"?role=staff&userId=attacker", operation.body, "valid")
			allowed := mask&4 != 0
			if (w.Code == 200) != allowed || (s.calls > 0) != allowed {
				t.Fatalf("authorization failed for %s %s roles %v: %d", operation.method, operation.path, assigned, w.Code)
			}
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("private response cached")
			}
		}
		for _, tc := range []struct {
			token string
			err   error
			code  int
		}{
			{"", nil, 401}, {"invalid", nil, 401}, {"valid", profile.ErrSuspended, 403},
		} {
			s := &eventsStub{}
			w := eventRequest(&profilesStub{roles: []string{"staff"}, err: tc.err}, s, operation.method, operation.path, operation.body, tc.token)
			if w.Code != tc.code || s.calls != 0 {
				t.Fatal("unauthorized event operation reached storage")
			}
		}
	}
}

func TestEventFieldsAndActor(t *testing.T) {
	p := &profilesStub{roles: []string{"staff"}}
	s := &eventsStub{}
	w := eventRequest(p, s, "PUT", "/staff/events/client-uuid?actor=attacker", validEventJSON, "valid")
	if w.Code != 200 || s.actor != "verified-owner" || s.id != "client-uuid" || s.input.Title != "Workshop" {
		t.Fatal("unverified actor or input")
	}
	var saved events.Event
	if json.Unmarshal(w.Body.Bytes(), &saved) != nil || saved.SyncStatus != "failed" {
		t.Fatal("calendar failure must return saved event status")
	}
	for _, body := range []string{"null", "[]", "{}", validEventJSON + `{}`, strings.Replace(validEventJSON, `"version":0`, `"actor":"attacker"`, 1), strings.Replace(validEventJSON, `"version":0`, `"status":"cancelled"`, 1), strings.Replace(validEventJSON, `"version":0`, `"calendarId":"attacker"`, 1), strings.Replace(validEventJSON, `"version":0`, `"timezone":"UTC"`, 1), strings.Replace(validEventJSON, "19:00", "17:00", 1), strings.Repeat("x", 33000)} {
		s = &eventsStub{}
		w = eventRequest(p, s, "PUT", "/staff/events/id", body, "valid")
		if w.Code != 400 || s.calls != 0 {
			t.Fatalf("invalid event accepted: %d", w.Code)
		}
	}
	for _, body := range []string{"null", "{}", `{"version":0}`, `{"version":1,"actor":"attacker"}`} {
		w = eventRequest(p, &eventsStub{}, "POST", "/staff/events/id/cancel", body, "valid")
		if w.Code != 400 {
			t.Fatal("invalid cancellation accepted")
		}
	}
}

func TestEventErrorMappingAndPreflight(t *testing.T) {
	for _, tc := range []struct {
		err  error
		code int
	}{
		{events.ErrInvalid, 400}, {events.ErrTime, 400}, {events.ErrNotFound, 404}, {events.ErrConflict, 409},
		{events.ErrCancelled, 409}, {events.ErrForbidden, 403}, {errors.New("secret credentials"), 503},
	} {
		w := eventRequest(&profilesStub{roles: []string{"staff"}}, &eventsStub{err: tc.err}, "POST", "/staff/events/id/sync", "", "valid")
		if w.Code != tc.code || strings.Contains(w.Body.String(), "secret") {
			t.Fatal("unsafe event error")
		}
	}
	r := httptest.NewRequest("OPTIONS", "/staff/events/id/sync", nil)
	r.Header.Set("Origin", "http://localhost:8000")
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", nil, nil, nil, nil).ServeHTTP(w, r)
	if w.Code != 204 || !strings.Contains(w.Header().Get("Access-Control-Allow-Methods"), "POST") {
		t.Fatal("event CORS preflight failed")
	}
}
