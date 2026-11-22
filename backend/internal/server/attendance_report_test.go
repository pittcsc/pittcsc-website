package server

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/roles"
)

func TestStaffAttendanceReport(t *testing.T) {
	profiles := &profilesStub{roles: []string{"member", "staff"}}
	store := &roleStoreStub{}
	for _, query := range []string{"year=25-26", "year=9999", "sort=title", "page=-1", "minEvents=-1", "minEvents=4.5", "minEvents=2147483648", "format=pdf"} {
		response := staffRequest(t, profiles, store, "GET", "/staff/attendance?"+query, "valid")
		if response.Code != 400 || store.calls != 0 {
			t.Fatalf("invalid attendance search reached storage: %s", query)
		}
	}

	response := staffRequest(t, profiles, store, "GET", "/staff/attendance?year=2025&q=Ada+Lovelace&sort=asc&page=2&minEvents=4", "valid")
	var report roles.AttendanceReport
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" ||
		json.Unmarshal(response.Body.Bytes(), &report) != nil || report.Year != 2025 || report.Page != 2 || report.MinEvents != 4 {
		t.Fatalf("unexpected attendance response: %d %s", response.Code, response.Body.String())
	}
	if store.calls != 1 || store.attendance.Query != "Ada Lovelace" || !store.attendance.Ascending || store.attendance.MinEvents != 4 || store.attendance.Unpaged {
		t.Fatalf("wrong attendance search: %+v", store.attendance)
	}
}

func TestStaffAttendanceCSV(t *testing.T) {
	profiles := &profilesStub{roles: []string{"member", "staff"}}
	store := &roleStoreStub{}
	for i := range roles.PageSize + 1 {
		name := fmt.Sprintf("Member %d", i+1)
		store.attendees = append(store.attendees, roles.MemberAttendance{FirstName: &name, EventsAttended: 4})
	}
	preferredName, lastName, title := "Ada", "Lovelace, Jr.", `=HYPERLINK("https://example.test")`
	start := time.Date(2025, time.September, 10, 22, 0, 0, 0, time.UTC)
	store.attendees[roles.PageSize] = roles.MemberAttendance{
		PreferredName: &preferredName, LastName: &lastName, EventsAttended: 5,
		LastEventTitle: &title, LastEventStart: &start,
	}
	response := staffRequest(t, profiles, store, "GET", "/staff/attendance?year=2025&format=csv&page=2&minEvents=4", "valid")
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" ||
		response.Header().Get("Content-Type") != "text/csv; charset=utf-8" ||
		response.Header().Get("Content-Disposition") != `attachment; filename="pittcsc-attendance-2025-2026.csv"` {
		t.Fatalf("unexpected CSV response: %d %v", response.Code, response.Header())
	}
	if store.calls != 1 || !store.attendance.Unpaged || store.attendance.Year != 2025 || store.attendance.MinEvents != 4 {
		t.Fatalf("wrong CSV attendance search: %+v", store.attendance)
	}
	rows, err := csv.NewReader(response.Body).ReadAll()
	if err != nil || len(rows) != roles.PageSize+2 {
		t.Fatalf("unexpected CSV row count: %d, %v", len(rows), err)
	}
	if !slices.Equal(rows[1], []string{"Member 1", "4", "", ""}) ||
		!slices.Equal(rows[len(rows)-1], []string{"Ada Lovelace, Jr.", "5", "'" + title, "2025-09-10T22:00:00Z"}) {
		t.Fatal("CSV did not preserve data or escape spreadsheet formulas")
	}
}
