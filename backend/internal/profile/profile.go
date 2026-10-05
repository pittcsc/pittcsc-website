package profile

import (
	"context"
	"errors"
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
	FirstName      *string   `json:"firstName"`
	LastName       *string   `json:"lastName"`
	PreferredName  *string   `json:"preferredName"`
	GraduationYear *int      `json:"graduationYear"`
	Majors         []string  `json:"majors"`
	Complete       bool      `json:"complete"`
	HasResume      bool      `json:"hasResume"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type Input struct {
	FirstName      *string  `json:"firstName"`
	LastName       *string  `json:"lastName"`
	PreferredName  *string  `json:"preferredName"`
	GraduationYear *int     `json:"graduationYear"`
	Majors         []string `json:"majors"`
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
	return nil
}

func complete(record Record) bool {
	return record.FirstName != nil && record.LastName != nil && record.GraduationYear != nil && len(record.Majors) > 0
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
		  account_status, resume_asset_id is not null, updated_at
		from csc.profiles where auth_user_id = $1::uuid
	`, authUserID).Scan(&record.FirstName, &record.LastName, &record.PreferredName,
		&record.GraduationYear, &record.Majors, &status, &record.HasResume, &record.UpdatedAt)
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
		  graduation_year = $5, majors = $6, updated_at = now()
		where auth_user_id = $1::uuid and account_status = 'active'
		returning account_status
	`, authUserID, input.FirstName, input.LastName, input.PreferredName, input.GraduationYear, input.Majors).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, ErrSuspended
	}
	if err != nil {
		return Record{}, err
	}
	return s.Get(ctx, authUserID)
}
