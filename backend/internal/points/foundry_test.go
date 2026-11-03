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
		status := NewFoundryStatus("Ada", tc.points, &until, nil)
		if status.Active != tc.active || status.Threshold != FoundryThreshold || status.WindowDays != FoundryWindowDays {
			t.Errorf("%d points: %+v", tc.points, status)
		}
		if tc.active != (status.ActiveUntil != nil) {
			t.Errorf("%d points: activeUntil %v", tc.points, status.ActiveUntil)
		}
	}
}

func TestFoundryGrantAndPointsOverlap(t *testing.T) {
	pointsUntil := time.Date(2026, 11, 20, 15, 0, 0, 0, time.UTC)
	grantUntil := pointsUntil.Add(24 * time.Hour)
	granted := NewFoundryStatus("Ada", 20, nil, &grantUntil)
	if !granted.Active || granted.ActiveUntil == nil || !granted.ActiveUntil.Equal(grantUntil) || granted.GrantExpiresAt == nil {
		t.Fatalf("grant did not activate status below threshold: %+v", granted)
	}
	overlap := NewFoundryStatus("Ada", 50, &pointsUntil, &grantUntil)
	if !overlap.Active || overlap.ActiveUntil == nil || !overlap.ActiveUntil.Equal(grantUntil) {
		t.Fatalf("overlapping grant did not extend status: %+v", overlap)
	}
	pointsOnly := NewFoundryStatus("Ada", 50, &pointsUntil, nil)
	if !pointsOnly.Active || pointsOnly.GrantExpiresAt != nil || !pointsOnly.ActiveUntil.Equal(pointsUntil) {
		t.Fatalf("revoking grant removed earned status: %+v", pointsOnly)
	}
}
