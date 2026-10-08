package server

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

func TestAttendanceRequiresVerifiedActiveAccountAndExplicitPost(t *testing.T) {
	for _, method := range []string{"GET", "POST"} {
		for _, tc := range []struct {
			token      string
			profileErr error
			code       int
		}{
			{"", nil, 401},
			{"invalid", nil, 401},
			{"valid", profile.ErrSuspended, 403},
			{"valid", nil, 200},
		} {
			s := &eventsStub{}
			w := eventRequest(&profilesStub{roles: []string{"member", "alumni"}, err: tc.profileErr}, s,
				method, "/attendance/event-id?userId=attacker", "", tc.token)
			if w.Code != tc.code {
				t.Fatalf("%s attendance access: got %d, want %d", method, w.Code, tc.code)
			}
			if tc.code == 200 {
				if s.actor != "verified-owner" || s.id != "event-id" || s.attendanceCalls != 1 {
					t.Fatal("attendance must use verified identity and event path")
				}
			} else if s.attendanceCalls != 0 {
				t.Fatal("denied attendance reached storage")
			}
		}
	}
	s := &eventsStub{}
	w := eventRequest(&profilesStub{roles: []string{"member"}}, s, "GET", "/attendance/event-id", "", "valid")
	if w.Code != 200 || s.attendanceCalls != 1 {
		t.Fatal("status read failed")
	}
	var state map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &state); err != nil || state["checkedInAt"] != nil {
		t.Fatal("GET must not mark attendance")
	}
	if strings.Contains(w.Body.String(), "attendees") {
		t.Fatal("member attendance response leaked roster")
	}
}

func TestAttendanceRosterIsStaffOnly(t *testing.T) {
	for _, roles := range [][]string{{"member"}, {"member", "foundry", "alumni"}, {"member", "staff"}} {
		s := &eventsStub{}
		w := eventRequest(&profilesStub{roles: roles}, s, "GET", "/staff/events/event-id/attendance?page=2", "", "valid")
		allowed := len(roles) == 2 && roles[1] == "staff"
		if allowed && (w.Code != 200 || s.attendanceCalls != 1) || !allowed && (w.Code != 403 || s.attendanceCalls != 0) {
			t.Fatalf("roster authorization for %v: %d", roles, w.Code)
		}
	}
	w := eventRequest(&profilesStub{roles: []string{"staff"}}, &eventsStub{}, "GET", "/staff/events/event-id/attendance?page=bogus", "", "valid")
	if w.Code != 400 {
		t.Fatal("invalid roster page accepted")
	}
}
