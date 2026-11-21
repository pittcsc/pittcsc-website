package server

import (
	"encoding/json"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/roles"
)

func TestStaffAttendanceReport(t *testing.T) {
	profiles := &profilesStub{roles: []string{"member", "staff"}}
	store := &roleStoreStub{}
	for _, query := range []string{"year=25-26", "year=9999", "sort=title", "page=-1"} {
		response := staffRequest(t, profiles, store, "GET", "/staff/attendance?"+query, "valid")
		if response.Code != 400 || store.calls != 0 {
			t.Fatalf("invalid attendance search reached storage: %s", query)
		}
	}

	response := staffRequest(t, profiles, store, "GET", "/staff/attendance?year=2025&q=Ada+Lovelace&sort=asc&page=2", "valid")
	var report roles.AttendanceReport
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" ||
		json.Unmarshal(response.Body.Bytes(), &report) != nil || report.Year != 2025 || report.Page != 2 {
		t.Fatalf("unexpected attendance response: %d %s", response.Code, response.Body.String())
	}
	if store.calls != 1 || store.attendance.Query != "Ada Lovelace" || !store.attendance.Ascending {
		t.Fatalf("wrong attendance search: %+v", store.attendance)
	}
}
