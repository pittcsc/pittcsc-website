package points

import "time"

// A member has active Foundry status with enough recent awarded points or an
// active staff grant. Neither path assigns the legacy foundry role.
const (
	FoundryThreshold  = 50
	FoundryWindowDays = 30
)

type FoundryStatus struct {
	Name       string `json:"name"`
	Points     int    `json:"points"`
	Threshold  int    `json:"threshold"`
	WindowDays int    `json:"windowDays"`
	Active     bool   `json:"active"`
	// ActiveUntil is when an active status lapses if no new points are
	// awarded: the moment the window stops covering enough recent claims.
	ActiveUntil    *time.Time `json:"activeUntil"`
	GrantExpiresAt *time.Time `json:"grantExpiresAt"`
}

func NewFoundryStatus(name string, points int, pointsUntil, grantUntil *time.Time) FoundryStatus {
	status := FoundryStatus{
		Name:           name,
		Points:         points,
		Threshold:      FoundryThreshold,
		WindowDays:     FoundryWindowDays,
		Active:         points >= FoundryThreshold || grantUntil != nil,
		GrantExpiresAt: grantUntil,
	}
	if points >= FoundryThreshold {
		status.ActiveUntil = pointsUntil
	}
	if grantUntil != nil && (status.ActiveUntil == nil || grantUntil.After(*status.ActiveUntil)) {
		status.ActiveUntil = grantUntil
	}
	return status
}
