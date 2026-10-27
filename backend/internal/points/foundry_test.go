package points

import (
	"testing"
	"time"
)

func TestClubMonthResetsAtNewYorkMidnight(t *testing.T) {
	for _, tc := range []struct {
		now, start, end string
	}{
		// EDT ends on 2026-11-01; October still starts and ends at local midnight.
		{"2026-11-01T03:59:59Z", "2026-10-01T04:00:00Z", "2026-11-01T04:00:00Z"},
		{"2026-11-01T04:00:00Z", "2026-11-01T04:00:00Z", "2026-12-01T05:00:00Z"},
		// EST to EDT inside March.
		{"2026-03-01T05:00:00Z", "2026-03-01T05:00:00Z", "2026-04-01T04:00:00Z"},
		{"2026-03-01T04:59:59Z", "2026-02-01T05:00:00Z", "2026-03-01T05:00:00Z"},
		{"2026-12-31T23:00:00Z", "2026-12-01T05:00:00Z", "2027-01-01T05:00:00Z"},
	} {
		now, _ := time.Parse(time.RFC3339, tc.now)
		start, end := ClubMonth(now)
		if got := start.UTC().Format(time.RFC3339); got != tc.start {
			t.Errorf("%s start = %s, want %s", tc.now, got, tc.start)
		}
		if got := end.UTC().Format(time.RFC3339); got != tc.end {
			t.Errorf("%s end = %s, want %s", tc.now, got, tc.end)
		}
	}
}

func TestFoundryStatusThreshold(t *testing.T) {
	start, _ := ClubMonth(time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC))
	for _, tc := range []struct {
		points int
		active bool
	}{{0, false}, {FoundryThreshold - 1, false}, {FoundryThreshold, true}, {FoundryThreshold + 30, true}} {
		status := NewFoundryStatus("Ada", start, tc.points)
		if status.Active != tc.active || status.Month != "2026-10" || status.Threshold != FoundryThreshold {
			t.Errorf("%d points: %+v", tc.points, status)
		}
	}
}
