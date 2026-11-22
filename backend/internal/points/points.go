package points

import (
	"errors"
	"net"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrInvalidSummary     = errors.New("summary must contain 100–250 characters")
	ErrHistoryUnavailable = errors.New("submission history is unavailable")
	ErrInvalid            = errors.New("invalid point claim")
	ErrDuplicate          = errors.New("link already claimed")
	ErrNotFound           = errors.New("point claim not found")
	ErrConflict           = errors.New("point claim conflict")
)

const PageSize = 20

var (
	leetcodeSubmissionPath = regexp.MustCompile(`^/problems/[a-z0-9-]+/submissions/[0-9]+(?:/.*)?$`)
	leetcodeSolutionPath   = regexp.MustCompile(`^/problems/[a-z0-9-]+/solutions/[0-9]+(?:/.*)?$`)
	githubPull             = regexp.MustCompile(`^/[^/]+/[^/]+/pull/[0-9]+(?:/.*)?$`)
	githubCommit           = regexp.MustCompile(`^/[^/]+/[^/]+/commit/[0-9a-fA-F]{7,40}(?:/.*)?$`)
)

type Category struct {
	Code   string `json:"code"`
	Label  string `json:"label"`
	Points int    `json:"points"`
}

type Input struct {
	Summary  string `json:"summary"`
	Category string `json:"category"`
	URL      string `json:"url"`
	Affirmed bool   `json:"affirmed"`
}

type Correction struct {
	Category string `json:"category"`
	URL      string `json:"url"`
	Reason   string `json:"reason"`
}

type Claim struct {
	Summary      *string   `json:"summary"`
	ID           string    `json:"id"`
	Category     string    `json:"category"`
	URL          string    `json:"url"`
	Points       int       `json:"points"`
	Status       string    `json:"status"`
	AwardedAt    time.Time `json:"awardedAt"`
	ChangedAt    time.Time `json:"changedAt"`
	StatusReason *string   `json:"statusReason"`
	MemberName   string    `json:"memberName,omitempty"`
	MemberID     string    `json:"memberID,omitempty"`
}

type Mine struct {
	AllTime    int     `json:"allTime"`
	Last30Days int     `json:"last30Days"`
	Claims     []Claim `json:"claims"`
	HasMore    bool    `json:"hasMore"`
}

type Standing struct {
	ID     string `json:"id"`
	Rank   int    `json:"rank"`
	Name   string `json:"name"`
	Points int    `json:"points"`
	IsYou  bool   `json:"isYou"`
}

type Leaderboard struct {
	Period  string     `json:"period"`
	Entries []Standing `json:"entries"`
	Own     *Standing  `json:"own,omitempty"`
}

type SharedSubmission struct {
	ID        string    `json:"id"`
	Label     string    `json:"label"`
	URL       string    `json:"url"`
	Summary   *string   `json:"summary"`
	Points    int       `json:"points"`
	Status    string    `json:"status"`
	AwardedAt time.Time `json:"awardedAt"`
}

type SharedHistory struct {
	Claims  []SharedSubmission `json:"claims"`
	HasMore bool               `json:"hasMore"`
}

type StaffPage struct {
	Claims  []Claim `json:"claims"`
	HasMore bool    `json:"hasMore"`
}

func ParsePage(raw string) (int, error) {
	if raw == "" {
		return 1, nil
	}
	page, err := strconv.Atoi(raw)
	if err != nil || page < 1 || page > 100000 {
		return 0, ErrInvalid
	}
	return page, nil
}

func NormalizeSummary(value string) (string, error) {
	summary := strings.TrimSpace(value)
	length := utf8.RuneCountInString(summary)
	if length < 100 || length > 250 || !utf8.ValidString(summary) || strings.ContainsRune(summary, 0) {
		return "", ErrInvalidSummary
	}
	return summary, nil
}

func ValidReason(reason string) (string, error) {
	reason = strings.TrimSpace(reason)
	if len(reason) == 0 || len(reason) > 500 || strings.ContainsAny(reason, "\x00\r\n") {
		return "", ErrInvalid
	}
	return reason, nil
}

// NormalizeURL makes trivial URL variants one lifetime claim. It never fetches
// a third-party URL; public visibility and authorship are honor-system rules.
func NormalizeURL(category, raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if len(raw) == 0 || len(raw) > 2048 || strings.ContainsAny(raw, "\x00\r\n\t ") {
		return "", ErrInvalid
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Hostname() == "" || u.Opaque != "" {
		return "", ErrInvalid
	}
	host := strings.ToLower(u.Hostname())
	if net.ParseIP(host) != nil || strings.HasSuffix(host, ".") {
		return "", ErrInvalid
	}
	port := u.Port()
	if port != "" && port != "443" {
		return "", ErrInvalid
	}
	u.Host = host
	u.Scheme = "https"
	u.Fragment = ""
	u.RawFragment = ""
	if strings.Contains(strings.ToLower(u.EscapedPath()), "%2f") {
		return "", ErrInvalid
	}
	path := strings.TrimRight(u.Path, "/")
	if path == "" {
		path = "/"
	}
	if strings.Contains(path, "..") {
		return "", ErrInvalid
	}
	isLeetCodeHost := host == "leetcode.com" || host == "www.leetcode.com"
	isSubmission := isLeetCodeHost && leetcodeSubmissionPath.MatchString(path)
	isLegacySolution := isLeetCodeHost && leetcodeSolutionPath.MatchString(path)
	isProject := (host == "github.com" || host == "www.github.com") && (githubPull.MatchString(path) || githubCommit.MatchString(path))
	switch category {
	case "leetcode":
		if !isSubmission {
			return "", ErrInvalid
		}
	case "project":
		if !isProject {
			return "", ErrInvalid
		}
	case "paper":
		// Papers can live on any HTTPS host. Keep canonicalizing recognized
		// links, including legacy solutions, for the lifetime duplicate check.
	default:
		return "", ErrInvalid
	}
	if isSubmission || isLegacySolution {
		parts := strings.Split(path, "/")
		path = strings.Join(parts[:5], "/")
		u.Host = "leetcode.com"
		u.RawQuery = ""
	} else if isProject {
		parts := strings.Split(path, "/")
		parts[1], parts[2] = strings.ToLower(parts[1]), strings.ToLower(parts[2])
		path = strings.Join(parts[:5], "/")
		if parts[3] == "commit" {
			parts[4] = strings.ToLower(parts[4])
			path = strings.Join(parts[:5], "/")
		}
		u.Host = "github.com"
		u.RawQuery = ""
	} else {
		query := u.Query()
		for key := range query {
			lower := strings.ToLower(key)
			if strings.HasPrefix(lower, "utm_") || lower == "fbclid" || lower == "gclid" {
				query.Del(key)
			}
		}
		// url.Values.Encode sorts keys and values, making query order irrelevant.
		for key := range query {
			sort.Strings(query[key])
		}
		u.RawQuery = query.Encode()
	}
	u.Path = path
	u.RawPath = ""
	result := u.String()
	if len(result) > 2048 {
		return "", ErrInvalid
	}
	return result, nil
}
