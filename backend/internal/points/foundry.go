package points

import (
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/events"
)

// FoundryThreshold is the number of awarded points a member must earn within
// one club calendar month for an active Foundry status. The status is
// informational; it does not grant the foundry role or any privileges.
const FoundryThreshold = 50

var clubTime, _ = time.LoadLocation(events.Timezone)

type FoundryStatus struct {
	Name      string `json:"name"`
	Month     string `json:"month"`
	Points    int    `json:"points"`
	Threshold int    `json:"threshold"`
	Active    bool   `json:"active"`
}

// ClubMonth returns the club calendar month containing now as a half-open
// [start, end) range. Months follow New York time so the reset happens at
// local midnight on the 1st, including across daylight-saving changes.
func ClubMonth(now time.Time) (start, end time.Time) {
	local := now.In(clubTime)
	start = time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, clubTime)
	return start, start.AddDate(0, 1, 0)
}

func NewFoundryStatus(name string, monthStart time.Time, points int) FoundryStatus {
	return FoundryStatus{
		Name:      name,
		Month:     monthStart.In(clubTime).Format("2006-01"),
		Points:    points,
		Threshold: FoundryThreshold,
		Active:    points >= FoundryThreshold,
	}
}
