package server

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/roles"
)

func writeAttendanceCSV(w http.ResponseWriter, report roles.AttendanceReport) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="pittcsc-attendance-%d-%d.csv"`, report.Year, report.Year+1))
	writer := csv.NewWriter(w)
	_ = writer.Write([]string{"Member", "Events attended", "Last event attended", "Last event start (UTC)"})
	for _, member := range report.Members {
		firstName := attendanceText(member.PreferredName)
		if firstName == "" {
			firstName = attendanceText(member.FirstName)
		}
		name := strings.TrimSpace(firstName + " " + attendanceText(member.LastName))
		if name == "" {
			name = "No name yet"
		}
		var start string
		if member.LastEventStart != nil {
			start = member.LastEventStart.UTC().Format(time.RFC3339)
		}
		_ = writer.Write([]string{
			safeCSVCell(name), strconv.Itoa(member.EventsAttended),
			safeCSVCell(attendanceText(member.LastEventTitle)), start,
		})
	}
	writer.Flush()
}

func attendanceText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
