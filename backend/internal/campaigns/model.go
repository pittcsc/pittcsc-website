// Package campaigns owns contacts, shared drafts, durable dispatch, and reporting.
package campaigns

import (
	"errors"
	"net"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"
	_ "time/tzdata"
	"unicode"
	"unicode/utf8"
)

var (
	ErrInvalid  = errors.New("check the campaign or contact fields")
	ErrConflict = errors.New("this record changed; reload before saving")
	ErrNotFound = errors.New("record not found")
	ErrDisabled = errors.New("campaign delivery is not configured")
	ErrBlocked  = errors.New("this recipient is unsubscribed, archived, or blocked")
	idPattern   = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
)

func ValidID(s string) bool { return idPattern.MatchString(s) }
func validText(s string, n int, multi bool) bool {
	return utf8.ValidString(s) && utf8.RuneCountInString(s) <= n && !strings.ContainsFunc(s, func(r rune) bool { return unicode.IsControl(r) && !(multi && (r == '\n' || r == '\t')) })
}
func Email(s string) (string, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	a, e := mail.ParseAddress(s)
	if e != nil || a.Address != s || len(s) > 254 || strings.ContainsAny(s, "<>\" \r\n\t") || !strings.Contains(strings.Split(s, "@")[len(strings.Split(s, "@"))-1], ".") {
		return "", ErrInvalid
	}
	return s, nil
}
func safeURL(s string) bool {
	if strings.ContainsAny(s, "\"<> \r\n\t") {
		return false
	}
	u, e := url.Parse(s)
	if e != nil || u.Hostname() == "" || u.User != nil {
		return false
	}
	if u.Scheme == "https" {
		return true
	}
	ip := net.ParseIP(u.Hostname())
	return u.Scheme == "http" && (u.Hostname() == "localhost" || ip != nil && ip.IsLoopback())
}
func labels(in []string, max int) ([]string, error) {
	out := []string{}
	seen := map[string]bool{}
	if len(in) > max {
		return nil, ErrInvalid
	}
	for _, v := range in {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if !validText(v, 120, false) {
			return nil, ErrInvalid
		}
		if !seen[strings.ToLower(v)] {
			out = append(out, v)
			seen[strings.ToLower(v)] = true
		}
	}
	return out, nil
}

type Contact struct {
	ID         string   `json:"id"`
	Email      string   `json:"email"`
	UserID     *string  `json:"userId"`
	FirstName  string   `json:"firstName"`
	LastName   string   `json:"lastName"`
	Year       *int     `json:"graduationYear"`
	Majors     []string `json:"majors"`
	Tags       []string `json:"tags"`
	Roles      []string `json:"roles"`
	Attendance []string `json:"attendance"`
	Subscribed bool     `json:"subscribed"`
	Archived   bool     `json:"archived"`
	Blocked    string   `json:"blockedReason"`
	Active     bool     `json:"active"`
	Version    int      `json:"version"`
	Token      string   `json:"-"`
}
type ContactInput struct {
	FirstName string   `json:"firstName"`
	LastName  string   `json:"lastName"`
	Email     string   `json:"email"`
	Year      *int     `json:"graduationYear"`
	Majors    []string `json:"majors"`
	Tags      []string `json:"tags"`
	Archived  bool     `json:"archived"`
	Version   int      `json:"version"`
}

func (v *ContactInput) Validate() error {
	var e error
	v.FirstName = strings.TrimSpace(v.FirstName)
	v.LastName = strings.TrimSpace(v.LastName)
	v.Email, e = Email(v.Email)
	if e != nil || !validText(v.FirstName, 100, false) || !validText(v.LastName, 100, false) || v.Version < 0 || v.Year != nil && (*v.Year < 1900 || *v.Year > 2100) {
		return ErrInvalid
	}
	v.Majors, e = labels(v.Majors, 8)
	if e != nil {
		return e
	}
	v.Tags, e = labels(v.Tags, 50)
	return e
}

type Condition struct {
	Field string `json:"field"`
	Value string `json:"value"`
}
type Audience struct {
	Mode       string      `json:"mode"`
	Conditions []Condition `json:"conditions"`
	Exclusions []Condition `json:"exclusions"`
}

func (a Audience) Validate() error {
	if a.Mode != "all" && a.Mode != "any" || len(a.Conditions)+len(a.Exclusions) > 50 {
		return ErrInvalid
	}
	for _, c := range append(append([]Condition{}, a.Conditions...), a.Exclusions...) {
		if c.Value == "" || !validText(c.Value, 120, false) {
			return ErrInvalid
		}
		switch c.Field {
		case "tag", "role", "major", "graduationYear":
		case "attendance":
			if !ValidID(c.Value) {
				return ErrInvalid
			}
		default:
			return ErrInvalid
		}
	}
	return nil
}
func (a Audience) Matches(c Contact) bool {
	if !c.Subscribed || c.Archived || c.Blocked != "" || !c.Active {
		return false
	}
	return a.MatchesRules(c)
}
func (a Audience) MatchesRules(c Contact) bool {
	match := func(q Condition) bool {
		var values []string
		switch q.Field {
		case "tag":
			values = c.Tags
		case "role":
			values = c.Roles
		case "major":
			values = c.Majors
		case "attendance":
			values = c.Attendance
		case "graduationYear":
			if c.Year != nil {
				return q.Value == yearString(*c.Year)
			}
		}
		for _, v := range values {
			if strings.EqualFold(v, q.Value) {
				return true
			}
		}
		return false
	}
	for _, q := range a.Exclusions {
		if match(q) {
			return false
		}
	}
	if len(a.Conditions) == 0 {
		return true
	}
	for _, q := range a.Conditions {
		m := match(q)
		if a.Mode == "all" && !m {
			return false
		}
		if a.Mode == "any" && m {
			return true
		}
	}
	return a.Mode == "all"
}
func yearString(y int) string { return time.Date(y, 1, 1, 0, 0, 0, 0, time.UTC).Format("2006") }

type Block struct {
	Type     string  `json:"type"`
	Text     string  `json:"text,omitempty"`
	URL      string  `json:"url,omitempty"`
	Alt      string  `json:"alt,omitempty"`
	Children []Block `json:"children,omitempty"`
}

func ValidateBlocks(bs []Block) error { return validateBlocks(bs, 0) }
func validateBlocks(bs []Block, depth int) error {
	if len(bs) > 100 || depth > 2 {
		return ErrInvalid
	}
	for _, b := range bs {
		if !validText(b.Text, 10000, true) || !validText(b.Alt, 500, false) || len(b.URL) > 2000 {
			return ErrInvalid
		}
		switch b.Type {
		case "heading", "text", "divider", "event":
			if b.URL != "" && !safeURL(b.URL) {
				return ErrInvalid
			}
		case "image", "button":
			if b.URL != "" && !safeURL(b.URL) {
				return ErrInvalid
			}
		case "columns":
			if len(b.Children) < 1 || len(b.Children) > 3 {
				return ErrInvalid
			}
			if e := validateBlocks(b.Children, depth+1); e != nil {
				return e
			}
		default:
			return ErrInvalid
		}
		if b.Type != "columns" && len(b.Children) > 0 {
			return ErrInvalid
		}
	}
	return nil
}

type Draft struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Subject     string     `json:"subject"`
	Preheader   string     `json:"preheader"`
	Blocks      []Block    `json:"blocks"`
	Audience    Audience   `json:"audience"`
	Status      string     `json:"status"`
	Version     int        `json:"version"`
	ScheduledAt *time.Time `json:"scheduledAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	UpdatedBy   string     `json:"updatedBy"`
	EditorName  string     `json:"editorName"`
}
type DraftInput struct {
	Name      string   `json:"name"`
	Subject   string   `json:"subject"`
	Preheader string   `json:"preheader"`
	Blocks    []Block  `json:"blocks"`
	Audience  Audience `json:"audience"`
	Version   int      `json:"version"`
}

func (d *DraftInput) Validate() error {
	d.Name = strings.TrimSpace(d.Name)
	if d.Name == "" || !validText(d.Name, 200, false) || !validText(d.Subject, 200, false) || !validText(d.Preheader, 300, false) || d.Version < 0 {
		return ErrInvalid
	}
	if d.Blocks == nil {
		d.Blocks = []Block{}
	}
	if e := ValidateBlocks(d.Blocks); e != nil {
		return e
	}
	return d.Audience.Validate()
}
func ScheduleTime(raw string) (time.Time, error) {
	loc, _ := time.LoadLocation("America/New_York")
	t, e := time.ParseInLocation("2006-01-02T15:04", raw, loc)
	if e != nil || t.Format("2006-01-02T15:04") != raw || t.Add(time.Hour).In(loc).Format("2006-01-02T15:04") == raw || t.Add(-time.Hour).In(loc).Format("2006-01-02T15:04") == raw || !t.After(time.Now()) || t.Year() > 2100 {
		return time.Time{}, ErrInvalid
	}
	return t.UTC(), nil
}

// Drafts may contain an unfinished image/button; submitting mail may not.
func ReadyBlocks(bs []Block) bool {
	for _, b := range bs {
		if (b.Type == "image" || b.Type == "button") && b.URL == "" {
			return false
		}
		if !ReadyBlocks(b.Children) {
			return false
		}
	}
	return true
}
