package roles

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/events"
)

var ErrInvalidAttendanceSearch = errors.New("invalid attendance search")

type AttendanceSearch struct {
	Search
	Year        int
	CurrentYear int
	Ascending   bool
	MinEvents   int
	Unpaged     bool
}

type MemberAttendance struct {
	ID             string     `json:"id"`
	FirstName      *string    `json:"firstName"`
	LastName       *string    `json:"lastName"`
	PreferredName  *string    `json:"preferredName"`
	EventsAttended int        `json:"eventsAttended"`
	LastEventTitle *string    `json:"lastEventTitle"`
	LastEventStart *time.Time `json:"lastEventStart"`
}

type AttendanceReport struct {
	Members     []MemberAttendance `json:"members"`
	Year        int                `json:"year"`
	CurrentYear int                `json:"currentYear"`
	FirstYear   int                `json:"firstYear"`
	Page        int                `json:"page"`
	HasMore     bool               `json:"hasMore"`
}

var attendanceLocation, _ = time.LoadLocation(events.Timezone)

func academicYear(at time.Time) int {
	local := at.In(attendanceLocation)
	year := local.Year()
	if local.Month() < time.August {
		year--
	}
	return year
}

func academicYearStart(year int) time.Time {
	return time.Date(year, time.August, 1, 0, 0, 0, 0, attendanceLocation)
}

func ParseAttendanceSearch(query, page, year, sort, minEvents string, now time.Time) (AttendanceSearch, error) {
	search, err := ParseSearch(query, "", page)
	if err != nil || (sort != "" && sort != "desc" && sort != "asc") {
		return AttendanceSearch{}, ErrInvalidAttendanceSearch
	}
	currentYear := academicYear(now)
	result := AttendanceSearch{Search: search, Year: currentYear, CurrentYear: currentYear, Ascending: sort == "asc"}
	if year != "" {
		result.Year, err = strconv.Atoi(year)
		// Event validation accepts scheduled dates starting in 2000.
		if err != nil || len(year) != 4 || result.Year < 1999 || result.Year > currentYear {
			return AttendanceSearch{}, ErrInvalidAttendanceSearch
		}
	}
	if minEvents != "" {
		minimum, err := strconv.ParseUint(minEvents, 10, 31)
		if err != nil {
			return AttendanceSearch{}, ErrInvalidAttendanceSearch
		}
		result.MinEvents = int(minimum)
	}
	return result, nil
}

func (s Store) AttendanceReport(ctx context.Context, search AttendanceSearch) (AttendanceReport, error) {
	result := AttendanceReport{
		Members: []MemberAttendance{}, Year: search.Year, CurrentYear: search.CurrentYear,
		FirstYear: min(search.Year, search.CurrentYear-1), Page: search.Page,
	}
	var limit *int
	offset := 0
	if !search.Unpaged {
		var firstEvent *time.Time
		if err := s.DB.QueryRow(ctx, `select min(starts_at) from csc.events`).Scan(&firstEvent); err != nil {
			return AttendanceReport{}, err
		}
		if firstEvent != nil {
			result.FirstYear = min(result.FirstYear, academicYear(*firstEvent))
		}
		pageLimit := PageSize + 1
		limit = &pageLimit
		offset = (search.Page - 1) * PageSize
	}

	// The attendance key already enforces one row per member/event. Choose
	// the latest scheduled event and keep its title and date from the same row.
	rows, err := s.DB.Query(ctx, `
		with event_totals as (
			select distinct on (a.auth_user_id) a.auth_user_id,
				count(*) over (partition by a.auth_user_id) as event_count,
				e.title, e.starts_at
			from csc.events e join csc.attendance a on a.event_id = e.id
			where e.starts_at >= $2 and e.starts_at < $3
			order by a.auth_user_id, e.starts_at desc, e.id
		), members as (
			select p.auth_user_id, p.first_name, p.last_name, p.preferred_name,
				coalesce(t.event_count, 0) as event_count, t.title, t.starts_at
			from csc.profiles p join auth.users u on u.id = p.auth_user_id
			left join event_totals t on t.auth_user_id = p.auth_user_id
			where `+eligible+` and ($1::text is null or `+nameMatches+`)
		)
		select auth_user_id::text, first_name, last_name, preferred_name, event_count, title, starts_at
		from members
		where event_count >= $5
		order by case when $4::boolean then event_count end asc,
			case when not $4 then event_count end desc, lower(last_name) nulls last,
			lower(coalesce(preferred_name, first_name)) nulls last, auth_user_id
		limit $6 offset $7
	`, searchPattern(search.Query), academicYearStart(search.Year), academicYearStart(search.Year+1),
		search.Ascending, search.MinEvents, limit, offset)
	if err != nil {
		return AttendanceReport{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var member MemberAttendance
		err := rows.Scan(&member.ID, &member.FirstName, &member.LastName, &member.PreferredName,
			&member.EventsAttended, &member.LastEventTitle, &member.LastEventStart)
		if err != nil {
			return AttendanceReport{}, err
		}
		result.Members = append(result.Members, member)
	}
	if err := rows.Err(); err != nil {
		return AttendanceReport{}, err
	}
	if !search.Unpaged && len(result.Members) > PageSize {
		result.Members = result.Members[:PageSize]
		result.HasMore = true
	}
	return result, nil
}
