package roles

import (
	"testing"
	"time"
)

func TestAcademicYearRollover(t *testing.T) {
	// August 1 starts at 04:00 UTC in Pittsburgh.
	cutoff := time.Date(2026, time.August, 1, 4, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		at   time.Time
		year int
	}{
		{cutoff.Add(-time.Nanosecond), 2025},
		{cutoff, 2026},
		{cutoff.AddDate(1, 0, 0).Add(-time.Nanosecond), 2026},
		{cutoff.AddDate(1, 0, 0), 2027},
	} {
		search, err := ParseAttendanceSearch("", "", "", "", "", tc.at)
		if err != nil || search.Year != tc.year || search.CurrentYear != tc.year || search.Ascending {
			t.Fatalf("default attendance search at %s: %+v, %v", tc.at, search, err)
		}
	}
	if !academicYearStart(2026).Equal(cutoff) {
		t.Fatalf("wrong time boundary: %s", academicYearStart(2026))
	}
}
