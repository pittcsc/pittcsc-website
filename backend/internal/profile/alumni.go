package profile

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

var ErrIneligible = errors.New("complete your AlumniDB profile before publishing")

// AlumniFields are stored on the shared CRM record, never a second profile.
type AlumniFields struct {
	Location              *string `json:"location"`
	Bio                   *string `json:"bio"`
	CurrentCompany        *string `json:"currentCompany"`
	CurrentRole           *string `json:"currentRole"`
	PositionIsCurrent     bool    `json:"positionIsCurrent"`
	ContactEmail          *string `json:"contactEmail"`
	OpenToCoffeeChats     bool    `json:"openToCoffeeChats"`
	OpenToMentorship      bool    `json:"openToMentorship"`
	AvailableForReferrals bool    `json:"availableForReferrals"`
	OpenToResumeReview    bool    `json:"openToResumeReview"`
}

func (f *AlumniFields) Validate() error {
	for _, field := range []struct {
		p         **string
		max       int
		multiline bool
	}{
		{&f.Location, 200, false}, {&f.Bio, 4000, true}, {&f.CurrentCompany, 200, false}, {&f.CurrentRole, 200, false}, {&f.ContactEmail, 254, false},
	} {
		if *field.p == nil {
			continue
		}
		v := strings.TrimSpace(**field.p)
		if v == "" {
			*field.p = nil
			continue
		}
		if !utf8.ValidString(v) || utf8.RuneCountInString(v) > field.max || strings.ContainsRune(v, 0) || (!field.multiline && strings.ContainsAny(v, "\r\n")) {
			return ErrInvalid
		}
		*field.p = &v
	}
	if f.ContactEmail != nil {
		v := *f.ContactEmail
		a, err := mail.ParseAddress(v)
		parts := strings.Split(v, "@")
		if err != nil || a.Address != v || len(parts) != 2 || !strings.Contains(parts[1], ".") || strings.EqualFold(parts[1], "pitt.edu") || strings.ContainsAny(v, "<>\" ") {
			return ErrInvalid
		}
	}
	return nil
}

// AlumniMissing describes directory eligibility, independently of CRM completion.
func AlumniMissing(r Record, now time.Time) []string {
	missing := []string{}
	for _, f := range []struct {
		name  string
		value *string
	}{
		{"first name", r.FirstName}, {"last name", r.LastName}, {"location", r.Location}, {"bio", r.Bio},
		{"company", r.CurrentCompany}, {"job title", r.CurrentRole}, {"LinkedIn", r.LinkedInUsername}, {"non-Pitt contact email", r.ContactEmail},
	} {
		if f.value == nil || strings.TrimSpace(*f.value) == "" {
			missing = append(missing, f.name)
		}
	}
	ny, _ := time.LoadLocation("America/New_York")
	if r.GraduationYear == nil {
		missing = append(missing, "graduation year")
	} else if *r.GraduationYear > now.In(ny).Year() {
		missing = append(missing, "graduation year must be the current year or earlier")
	}
	if !r.HasAvatar {
		missing = append(missing, "profile photo")
	}
	if !r.OpenToCoffeeChats && !r.OpenToMentorship && !r.AvailableForReferrals && !r.OpenToResumeReview {
		missing = append(missing, "at least one offered kind of help")
	}
	return missing
}

func (s Store) SetAlumniPublication(ctx context.Context, userID string, published bool) (Record, error) {
	var id string
	err := s.DB.QueryRow(ctx, `update csc.profiles p set alumni_published=$2
 where auth_user_id=$1::uuid and account_status='active'
 and (not $2 or csc.alumni_eligible(p,extract(year from statement_timestamp() at time zone 'America/New_York')::integer))
 returning id::text`, userID, published).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		if _, e := s.Get(ctx, userID); e != nil {
			return Record{}, e
		}
		return Record{}, ErrIneligible
	}
	if err != nil {
		return Record{}, err
	}
	return s.Get(ctx, userID)
}
