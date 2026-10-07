package profile

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrSuspended = errors.New("account suspended")
	ErrInvalid   = errors.New("invalid profile")
	ErrNotFound  = errors.New("asset not found")
)

type Record struct {
	Roles            []string  `json:"-"`
	FirstName        *string   `json:"firstName"`
	LastName         *string   `json:"lastName"`
	PreferredName    *string   `json:"preferredName"`
	GraduationYear   *int      `json:"graduationYear"`
	Majors           []string  `json:"majors"`
	GitHubUsername   *string   `json:"githubUsername"`
	LeetCodeUsername *string   `json:"leetcodeUsername"`
	LinkedInUsername *string   `json:"linkedinUsername"`
	Complete         bool      `json:"complete"`
	HasAvatar        bool      `json:"hasAvatar"`
	HasResume        bool      `json:"hasResume"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type Input struct {
	FirstName        *string  `json:"firstName"`
	LastName         *string  `json:"lastName"`
	PreferredName    *string  `json:"preferredName"`
	GraduationYear   *int     `json:"graduationYear"`
	Majors           []string `json:"majors"`
	GitHubUsername   *string  `json:"githubUsername"`
	LeetCodeUsername *string  `json:"leetcodeUsername"`
	LinkedInUsername *string  `json:"linkedinUsername"`
}

// Handles are stored as bare usernames so nothing can put an arbitrary link in
// a field the UI renders as an anchor. The browser strips a pasted profile URL
// before sending; the API accepts only the username itself.
// The length is bounded separately rather than by the pattern. The database
// writes "no two hyphens in a row" as a lookahead, which does not consume, so
// its repetition count also caps the length. RE2 has no lookahead, so the Go
// pattern consumes the character after a hyphen and would otherwise accept
// "a-a-a-..." up to 77 characters -- passing here and then failing the check
// constraint as a 500 instead of a clean validation error.
type handleRule struct {
	pattern *regexp.Regexp
	maxLen  int
}

var (
	githubUsername   = handleRule{regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9]|-[A-Za-z0-9]){0,38}$`), 39}
	leetcodeUsername = handleRule{regexp.MustCompile(`^[A-Za-z0-9._-]{1,39}$`), 39}
	linkedinUsername = handleRule{regexp.MustCompile(`^[A-Za-z0-9-]{3,100}$`), 100}
)

func normalizeHandle(value **string, rule handleRule) error {
	if *value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(**value)
	if trimmed == "" {
		*value = nil
		return nil
	}
	if utf8.RuneCountInString(trimmed) > rule.maxLen || !rule.pattern.MatchString(trimmed) {
		return ErrInvalid
	}
	*value = &trimmed
	return nil
}

func normalizeName(value **string) error {
	if *value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(**value)
	if trimmed == "" {
		*value = nil
		return nil
	}
	if !utf8.ValidString(trimmed) || utf8.RuneCountInString(trimmed) > 100 || strings.ContainsAny(trimmed, "\x00\r\n") {
		return ErrInvalid
	}
	*value = &trimmed
	return nil
}

func (input *Input) Validate() error {
	if err := normalizeName(&input.FirstName); err != nil {
		return err
	}
	if err := normalizeName(&input.LastName); err != nil {
		return err
	}
	if err := normalizeName(&input.PreferredName); err != nil {
		return err
	}
	if input.GraduationYear != nil && (*input.GraduationYear < 1900 || *input.GraduationYear > 2100) {
		return ErrInvalid
	}
	if len(input.Majors) > 8 {
		return ErrInvalid
	}
	seen := make(map[string]bool, len(input.Majors))
	for i, major := range input.Majors {
		major = strings.TrimSpace(major)
		if !utf8.ValidString(major) || major == "" || utf8.RuneCountInString(major) > 120 || strings.ContainsAny(major, "\x00\r\n") || seen[strings.ToLower(major)] {
			return ErrInvalid
		}
		seen[strings.ToLower(major)] = true
		input.Majors[i] = major
	}
	if input.Majors == nil {
		input.Majors = []string{}
	}
	if err := normalizeHandle(&input.GitHubUsername, githubUsername); err != nil {
		return err
	}
	if err := normalizeHandle(&input.LeetCodeUsername, leetcodeUsername); err != nil {
		return err
	}
	if err := normalizeHandle(&input.LinkedInUsername, linkedinUsername); err != nil {
		return err
	}
	return nil
}

func complete(record Record) bool {
	return record.FirstName != nil && record.LastName != nil &&
		record.GraduationYear != nil && len(record.Majors) > 0 &&
		record.GitHubUsername != nil && record.LeetCodeUsername != nil &&
		record.LinkedInUsername != nil
}

type Store struct{ DB *pgxpool.Pool }

func (s Store) GetOrCreate(ctx context.Context, authUserID string) (Record, error) {
	_, err := s.DB.Exec(ctx, `insert into csc.profiles (auth_user_id) values ($1::uuid) on conflict (auth_user_id) do nothing`, authUserID)
	if err != nil {
		return Record{}, err
	}
	return s.Get(ctx, authUserID)
}

func (s Store) Get(ctx context.Context, authUserID string) (Record, error) {
	var record Record
	var status string
	err := s.DB.QueryRow(ctx, `
		select first_name, last_name, preferred_name, graduation_year, majors,
		  github_username, leetcode_username, linkedin_username,
		  account_status, avatar_asset_id is not null, resume_asset_id is not null, updated_at,
		  array(select role from csc.user_roles where auth_user_id = $1::uuid order by role)
		from csc.profiles where auth_user_id = $1::uuid
	`, authUserID).Scan(&record.FirstName, &record.LastName, &record.PreferredName,
		&record.GraduationYear, &record.Majors,
		&record.GitHubUsername, &record.LeetCodeUsername, &record.LinkedInUsername,
		&status, &record.HasAvatar, &record.HasResume, &record.UpdatedAt, &record.Roles)
	if err != nil {
		return Record{}, err
	}
	if status != "active" {
		return Record{}, ErrSuspended
	}
	record.Complete = complete(record)
	return record, nil
}

func (s Store) Update(ctx context.Context, authUserID string, input Input) (Record, error) {
	if err := input.Validate(); err != nil {
		return Record{}, err
	}
	var status string
	err := s.DB.QueryRow(ctx, `
		update csc.profiles set first_name = $2, last_name = $3, preferred_name = $4,
		  graduation_year = $5, majors = $6, github_username = $7,
		  leetcode_username = $8, linkedin_username = $9, updated_at = now()
		where auth_user_id = $1::uuid and account_status = 'active'
		returning account_status
	`, authUserID, input.FirstName, input.LastName, input.PreferredName,
		input.GraduationYear, input.Majors, input.GitHubUsername,
		input.LeetCodeUsername, input.LinkedInUsername).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, ErrSuspended
	}
	if err != nil {
		return Record{}, err
	}
	return s.Get(ctx, authUserID)
}
