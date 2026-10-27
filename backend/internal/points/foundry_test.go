package points

import (
	"testing"
	"time"
)

func TestFoundryStatusThreshold(t *testing.T) {
	until := time.Date(2026, 11, 20, 15, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		points int
		active bool
	}{{0, false}, {FoundryThreshold - 1, false}, {FoundryThreshold, true}, {FoundryThreshold + 30, true}} {
		status := NewFoundryStatus("Ada", tc.points, &until)
		if status.Active != tc.active || status.Threshold != FoundryThreshold || status.WindowDays != FoundryWindowDays {
			t.Errorf("%d points: %+v", tc.points, status)
		}
		if tc.active != (status.ActiveUntil != nil) {
			t.Errorf("%d points: activeUntil %v", tc.points, status.ActiveUntil)
		}
	}
}
