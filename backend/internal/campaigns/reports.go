package campaigns

import (
	"context"
	"encoding/csv"
	"io"
	"strconv"
	"strings"
)

type Recipient struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	Status      string `json:"status"`
	Reason      string `json:"reason"`
	Delivery    bool   `json:"delivered"`
	Bounced     bool   `json:"bounced"`
	Complaint   bool   `json:"complaint"`
	Unsubscribe bool   `json:"unsubscribed"`
}
type Clicks struct {
	URL       string `json:"url"`
	Total     int    `json:"total"`
	Unique    int    `json:"unique"`
	Automated int    `json:"automated"`
}
type Report struct {
	Tests      []Recipient      `json:"tests"`
	Recipients []Recipient      `json:"recipients"`
	Clicks     []Clicks         `json:"clicks"`
	Counts     map[string]int   `json:"counts"`
	History    []map[string]any `json:"history"`
}

func (s *Store) Report(ctx context.Context, id string) (Report, error) {
	out := Report{Tests: []Recipient{}, Recipients: []Recipient{}, Clicks: []Clicks{}, Counts: map[string]int{}, History: []map[string]any{}}
	if !ValidID(id) {
		return out, ErrInvalid
	}
	rows, e := s.DB.Query(ctx, `select r.id::text,r.email,r.first_name,r.last_name,r.status,r.reason,exists(select 1 from csc.email_events e where e.recipient_id=r.id and kind='delivery'),exists(select 1 from csc.email_events e where e.recipient_id=r.id and kind='bounce'),exists(select 1 from csc.email_events e where e.recipient_id=r.id and kind='complaint'),exists(select 1 from csc.email_events e where e.recipient_id=r.id and kind='unsubscribe'),r.is_test from csc.email_recipients r where campaign_id=$1::uuid order by r.created_at desc`, id)
	if e != nil {
		return out, e
	}
	for rows.Next() {
		var r Recipient
		var test bool
		if e = rows.Scan(&r.ID, &r.Email, &r.FirstName, &r.LastName, &r.Status, &r.Reason, &r.Delivery, &r.Bounced, &r.Complaint, &r.Unsubscribe, &test); e != nil {
			rows.Close()
			return out, e
		}
		if test {
			out.Tests = append(out.Tests, r)
			continue
		}
		out.Recipients = append(out.Recipients, r)
		out.Counts[r.Status]++
		out.Counts["recipients"]++
		if r.Delivery {
			out.Counts["delivered"]++
		}
		if r.Bounced {
			out.Counts["bounced"]++
		}
		if r.Complaint {
			out.Counts["complaints"]++
		}
		if r.Unsubscribe {
			out.Counts["unsubscribed"]++
		}
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return out, e
	}
	rows, e = s.DB.Query(ctx, `select e.link,count(*)::int,count(distinct e.recipient_id)::int,count(*) filter(where e.bot)::int from csc.email_events e join csc.email_recipients r on r.id=e.recipient_id where e.campaign_id=$1::uuid and e.kind='click' and not r.is_test group by e.link order by count(*) desc`, id)
	if e != nil {
		return out, e
	}
	for rows.Next() {
		var v Clicks
		if e = rows.Scan(&v.URL, &v.Total, &v.Unique, &v.Automated); e != nil {
			rows.Close()
			return out, e
		}
		out.Clicks = append(out.Clicks, v)
		out.Counts["clicks"] += v.Total
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return out, e
	}
	rows, e = s.DB.Query(ctx, `select h.action,h.created_at,coalesce(nullif(trim(concat(p.first_name,' ',p.last_name)),''),'Delivery worker') from csc.email_history h left join csc.profiles p on p.auth_user_id=h.actor_id where h.campaign_id=$1::uuid order by h.id desc limit 100`, id)
	if e != nil {
		return out, e
	}
	for rows.Next() {
		var action, actor string
		var at any
		if e = rows.Scan(&action, &at, &actor); e != nil {
			rows.Close()
			return out, e
		}
		out.History = append(out.History, map[string]any{"action": action, "actor": actor, "at": at})
	}
	e = rows.Err()
	rows.Close()
	return out, e
}
func csvSafe(s string) string {
	trim := strings.TrimLeft(s, " \t\r\n")
	if strings.HasPrefix(trim, "=") || strings.HasPrefix(trim, "+") || strings.HasPrefix(trim, "-") || strings.HasPrefix(trim, "@") || len(s) > 0 && (s[0] == '\t' || s[0] == '\r' || s[0] == '\n') {
		return "'" + s
	}
	return s
}
func WriteCSV(w io.Writer, rows [][]string) error {
	c := csv.NewWriter(w)
	for _, row := range rows {
		safe := make([]string, len(row))
		for i, v := range row {
			safe[i] = csvSafe(v)
		}
		if e := c.Write(safe); e != nil {
			return e
		}
	}
	c.Flush()
	return c.Error()
}
func (s *Store) ExportContacts(ctx context.Context, w io.Writer, a *Audience, q string, includeArchived bool) error {
	cs, e := s.Contacts(ctx)
	if e != nil {
		return e
	}
	rows := [][]string{{"first_name", "last_name", "email", "graduation_year", "majors", "tags", "subscribed", "archived", "delivery_block"}}
	for _, c := range cs {
		if !includeArchived && c.Archived {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(c.FirstName+" "+c.LastName+" "+c.Email+" "+strings.Join(c.Tags, " ")), strings.ToLower(q)) {
			continue
		}
		if a != nil && !a.MatchesRules(c) {
			continue
		}
		year := ""
		if c.Year != nil {
			year = strconv.Itoa(*c.Year)
		}
		rows = append(rows, []string{c.FirstName, c.LastName, c.Email, year, strings.Join(c.Majors, ";"), strings.Join(c.Tags, ";"), strconv.FormatBool(c.Subscribed), strconv.FormatBool(c.Archived), c.Blocked})
	}
	return WriteCSV(w, rows)
}
