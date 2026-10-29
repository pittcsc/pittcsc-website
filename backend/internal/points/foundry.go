package points

import "time"

// A member has an active Foundry status while their awarded points from the
// last FoundryWindowDays reach FoundryThreshold. The status is informational;
// it does not grant the foundry role or any privileges.
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
	ActiveUntil *time.Time `json:"activeUntil"`
}

func NewFoundryStatus(name string, points int, activeUntil *time.Time) FoundryStatus {
	status := FoundryStatus{
		Name:       name,
		Points:     points,
		Threshold:  FoundryThreshold,
		WindowDays: FoundryWindowDays,
		Active:     points >= FoundryThreshold,
	}
	if status.Active {
		status.ActiveUntil = activeUntil
	}
	return status
}
