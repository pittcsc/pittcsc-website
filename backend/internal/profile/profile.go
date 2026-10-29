package profile

import (
	"context"
	"errors"
	"net/mail"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrSuspended           = errors.New("account suspended")
	ErrInvalid             = errors.New("invalid profile")
	ErrNotFound            = errors.New("asset not found")
	ErrIncomplete          = errors.New("profile incomplete")
	ErrContactMatchesLogin = errors.New("contact email matches sign-in email")
)

type Record struct {
	Roles              []string  `json:"-"`
	IsAlumni           bool      `json:"isAlumni"`
	AlumniClaimed      bool      `json:"alumniClaimed"`
	FirstName          *string   `json:"firstName"`
	LastName           *string   `json:"lastName"`
	PreferredName      *string   `json:"preferredName"`
	GraduationYear     *int      `json:"graduationYear"`
	Majors             []string  `json:"majors"`
	GitHubUsername     *string   `json:"githubUsername"`
	LeetCodeUsername   *string   `json:"leetcodeUsername"`
	LinkedInUsername   *string   `json:"linkedinUsername"`
	CurrentCompany     *string   `json:"currentCompany"`
	JobTitle           *string   `json:"jobTitle"`
	Location           *string   `json:"location"`
	Bio                *string   `json:"bio"`
	PersonalWebsite    *string   `json:"personalWebsite"`
	OffersCoffee       bool      `json:"offersCoffee"`
	OffersMentorship   bool      `json:"offersMentorship"`
	OffersReferrals    bool      `json:"offersReferrals"`
	OffersResumeReview bool      `json:"offersResumeReview"`
	ContactEmail       *string   `json:"contactEmail"`
	DetailsShared      bool      `json:"detailsShared"`
	Complete           bool      `json:"complete"`
	HasAvatar          bool      `json:"hasAvatar"`
	HasResume          bool      `json:"hasResume"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type Input struct {
	FirstName          *string  `json:"firstName"`
	LastName           *string  `json:"lastName"`
	PreferredName      *string  `json:"preferredName"`
	GraduationYear     *int     `json:"graduationYear"`
	Majors             []string `json:"majors"`
	GitHubUsername     *string  `json:"githubUsername"`
	LeetCodeUsername   *string  `json:"leetcodeUsername"`
	LinkedInUsername   *string  `json:"linkedinUsername"`
	CurrentCompany     *string  `json:"currentCompany"`
	JobTitle           *string  `json:"jobTitle"`
	Location           *string  `json:"location"`
	Bio                *string  `json:"bio"`
	PersonalWebsite    *string  `json:"personalWebsite"`
	OffersCoffee       bool     `json:"offersCoffee"`
	OffersMentorship   bool     `json:"offersMentorship"`
	OffersReferrals    bool     `json:"offersReferrals"`
	OffersResumeReview bool     `json:"offersResumeReview"`
	ContactEmail       *string  `json:"contactEmail"`
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

func normalizeOptionalText(value **string, limit int, multiline bool) error {
	if *value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(**value)
	if trimmed == "" {
		*value = nil
		return nil
	}
	if !utf8.ValidString(trimmed) || utf8.RuneCountInString(trimmed) > limit || strings.ContainsRune(trimmed, 0) {
		return ErrInvalid
	}
	for _, character := range trimmed {
		if character < 32 && !(multiline && (character == '\n' || character == '\t')) {
			return ErrInvalid
		}
	}
	*value = &trimmed
	return nil
}

func normalizeWebsite(value **string) error {
	if err := normalizeOptionalText(value, 500, false); err != nil || *value == nil {
		return err
	}
	parsed, err := url.Parse(**value)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil || parsed.Opaque != "" || parsed.Fragment != "" {
		return ErrInvalid
	}
	return nil
}

func normalizeContactEmail(value **string) error {
	if *value == nil {
		return nil
	}
	contact := strings.TrimSpace(**value)
	if contact == "" {
		*value = nil
		return nil
	}
	address, err := mail.ParseAddress(contact)
	parts := strings.Split(contact, "@")
	if err != nil || address.Address != contact || len(parts) != 2 ||
		utf8.RuneCountInString(contact) > 254 || !strings.Contains(parts[1], ".") ||
		strings.ContainsAny(contact, "<>\" \r\n\t") {
		return ErrInvalid
	}
	*value = &contact
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
	for _, field := range []**string{&input.CurrentCompany, &input.JobTitle, &input.Location} {
		if err := normalizeOptionalText(field, 160, false); err != nil {
			return err
		}
	}
	if err := normalizeOptionalText(&input.Bio, 2000, true); err != nil {
		return err
	}
	if err := normalizeWebsite(&input.PersonalWebsite); err != nil {
		return err
	}
	if err := normalizeContactEmail(&input.ContactEmail); err != nil {
		return err
	}
	return nil
}

// Membership requires only the fields needed to identify a member in the directory.
func complete(record Record) bool {
	return record.FirstName != nil && record.LastName != nil &&
		record.GraduationYear != nil && len(record.Majors) > 0
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
	var alumniYearEligible bool
	err := s.DB.QueryRow(ctx, `
		select first_name, last_name, preferred_name, graduation_year, majors,
		  github_username, leetcode_username, linkedin_username,
		  current_company, job_title, location, bio, personal_website,
		  offers_coffee, offers_mentorship, offers_referrals, offers_resume_review,
		  contact_email, details_shared,
		  account_status, avatar_asset_id is not null, resume_asset_id is not null, updated_at,
		  coalesce(graduation_year <= extract(year from statement_timestamp() at time zone 'America/New_York')::integer, false),
		  array(select role from csc.user_roles where auth_user_id = $1::uuid order by role)
		from csc.profiles where auth_user_id = $1::uuid
	`, authUserID).Scan(&record.FirstName, &record.LastName, &record.PreferredName,
		&record.GraduationYear, &record.Majors,
		&record.GitHubUsername, &record.LeetCodeUsername, &record.LinkedInUsername,
		&record.CurrentCompany, &record.JobTitle, &record.Location, &record.Bio, &record.PersonalWebsite,
		&record.OffersCoffee, &record.OffersMentorship, &record.OffersReferrals, &record.OffersResumeReview,
		&record.ContactEmail, &record.DetailsShared,
		&status, &record.HasAvatar, &record.HasResume, &record.UpdatedAt, &alumniYearEligible, &record.Roles)
	if err != nil {
		return Record{}, err
	}
	if status != "active" {
		return Record{}, ErrSuspended
	}
	record.Complete = complete(record)
	record.AlumniClaimed = slices.Contains(record.Roles, "alumni")
	record.IsAlumni = alumniYearEligible && record.AlumniClaimed
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
		  leetcode_username = $8, linkedin_username = $9,
		  current_company = $10, job_title = $11, location = $12, bio = $13,
		  personal_website = $14, offers_coffee = $15, offers_mentorship = $16,
		  offers_referrals = $17, offers_resume_review = $18,
		  contact_email = $19, updated_at = now()
		where auth_user_id = $1::uuid and account_status = 'active'
		  and ($19::text is null or lower($19) <> (select lower(email) from auth.users where id = $1::uuid))
		returning account_status
	`, authUserID, input.FirstName, input.LastName, input.PreferredName,
		input.GraduationYear, input.Majors, input.GitHubUsername,
		input.LeetCodeUsername, input.LinkedInUsername,
		input.CurrentCompany, input.JobTitle, input.Location, input.Bio, input.PersonalWebsite,
		input.OffersCoffee, input.OffersMentorship, input.OffersReferrals, input.OffersResumeReview,
		input.ContactEmail).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		if _, lookupErr := s.Get(ctx, authUserID); lookupErr != nil {
			return Record{}, lookupErr
		}
		return Record{}, ErrContactMatchesLogin
	}
	if err != nil {
		return Record{}, err
	}
	return s.Get(ctx, authUserID)
}
