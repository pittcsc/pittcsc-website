package server

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/events"
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

func TestAttendanceCSVExport(t *testing.T) {
	s := &eventsStub{exportRows: []events.AttendanceExportRow{
		{Name: `Ada, "Analyst" Lovelace`, Email: "ada@pitt.edu"},
		{Name: "=SUM(1,2)", Email: "person@pitt.edu"},
		{Name: "First\nLast", Email: "second@pitt.edu"},
	}}
	w := eventRequest(&profilesStub{roles: []string{"member", "staff"}}, s,
		"GET", "/staff/events/event-id/attendance.csv", "", "valid")
	if w.Code != 200 || s.attendanceCalls != 1 || s.id != "event-id" {
		t.Fatalf("staff CSV export: status %d, calls %d", w.Code, s.attendanceCalls)
	}
	if w.Header().Get("Content-Type") != "text/csv; charset=utf-8" ||
		!strings.Contains(w.Header().Get("Content-Disposition"), "attachment;") ||
		w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("CSV response missing download or private-cache headers")
	}
	reader := csv.NewReader(strings.NewReader(w.Body.String()))
	got, err := reader.ReadAll()
	if err != nil {
		t.Fatal(err)
	}
	want := [][]string{{"Name", "Email"}, {`Ada, "Analyst" Lovelace`, "ada@pitt.edu"}, {"'=SUM(1,2)", "person@pitt.edu"}, {"First\nLast", "second@pitt.edu"}}
	if len(got) != len(want) {
		t.Fatalf("got %d CSV rows, want %d", len(got), len(want))
	}
	for i := range want {
		if len(got[i]) != 2 || got[i][0] != want[i][0] || got[i][1] != want[i][1] {
			t.Fatalf("CSV row %d has unexpected columns or content: %q", i, got[i])
		}
	}

	s = &eventsStub{}
	w = eventRequest(&profilesStub{roles: []string{"staff"}}, s,
		"GET", "/staff/events/event-id/attendance.csv", "", "valid")
	if w.Code != 200 || w.Body.String() != "Name,Email\n" {
		t.Fatal("empty attendance should export header only")
	}

	s = &eventsStub{err: events.ErrNotFound}
	w = eventRequest(&profilesStub{roles: []string{"staff"}}, s,
		"GET", "/staff/events/missing/attendance.csv", "", "valid")
	if w.Code != 404 || strings.Contains(w.Body.String(), "Name,Email") {
		t.Fatal("missing event returned CSV")
	}

	s = &eventsStub{err: errors.New("database unavailable")}
	w = eventRequest(&profilesStub{roles: []string{"staff"}}, s,
		"GET", "/staff/events/event-id/attendance.csv", "", "valid")
	if w.Code != 503 || strings.Contains(w.Body.String(), "Name,Email") {
		t.Fatal("failed export returned partial CSV")
	}

	for _, value := range []string{" +SUM(1,2)", "-1+2", "@cmd", "\t=1"} {
		if got := safeCSVCell(value); got != "'"+value {
			t.Fatalf("formula prefix was not escaped: %q", value)
		}
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
