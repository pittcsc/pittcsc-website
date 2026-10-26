package profile

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

// DirectoryRecord deliberately does not embed Record: only published fields
// cross this read interface. Snake-case fields retain AlumniDB's UI contract.
type DirectoryRecord struct {
	ID                    string    `json:"id"`
	FullName              string    `json:"full_name"`
	GraduationYear        int       `json:"graduation_year"`
	Location              string    `json:"location"`
	Bio                   string    `json:"bio"`
	CurrentCompany        string    `json:"current_company"`
	CurrentRole           string    `json:"current_role"`
	PositionIsCurrent     bool      `json:"position_is_current"`
	LinkedInURL           string    `json:"linkedin_url"`
	ContactEmail          string    `json:"contact_email"`
	OpenToCoffeeChats     bool      `json:"open_to_coffee_chats"`
	OpenToMentorship      bool      `json:"open_to_mentorship"`
	AvailableForReferrals bool      `json:"available_for_referrals"`
	OpenToResumeReview    bool      `json:"open_to_resume_review"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type DirectoryQuery struct {
	Search, Company, Location             string
	Year, Page                            int
	Coffee, Mentorship, Referrals, Resume bool
}
type DirectoryOptions struct {
	Locations []string `json:"locations"`
	Companies []string `json:"companies"`
	Years     []int    `json:"years"`
}
type DirectoryPage struct {
	Data    []DirectoryRecord `json:"data"`
	Count   int               `json:"count"`
	HasMore bool              `json:"hasMore"`
	Options DirectoryOptions  `json:"options"`
}

func ParseDirectoryQuery(v url.Values) (DirectoryQuery, error) {
	q := DirectoryQuery{Page: 1}
	for key, values := range v {
		if len(values) != 1 {
			return q, ErrInvalid
		}
		value := strings.TrimSpace(values[0])
		switch key {
		case "search", "company", "location":
			max := 200
			if key == "search" {
				max = 100
			}
			if !utf8.ValidString(value) || utf8.RuneCountInString(value) > max || strings.ContainsAny(value, "\x00\r\n") {
				return q, ErrInvalid
			}
			switch key {
			case "search":
				q.Search = value
			case "company":
				q.Company = value
			case "location":
				q.Location = value
			}
		case "graduation_year", "page":
			if value == "" {
				continue
			}
			n, err := strconv.Atoi(value)
			if err != nil {
				return q, ErrInvalid
			}
			if key == "page" {
				if n < 1 || n > 50000 {
					return q, ErrInvalid
				}
				q.Page = n
			} else {
				if n < 1900 || n > 2100 {
					return q, ErrInvalid
				}
				q.Year = n
			}
		case "open_to_coffee_chats", "open_to_mentorship", "available_for_referrals", "open_to_resume_review":
			if value != "true" && value != "false" {
				return q, ErrInvalid
			}
			yes := value == "true"
			switch key {
			case "open_to_coffee_chats":
				q.Coffee = yes
			case "open_to_mentorship":
				q.Mentorship = yes
			case "available_for_referrals":
				q.Referrals = yes
			case "open_to_resume_review":
				q.Resume = yes
			}
		default:
			return q, ErrInvalid
		}
	}
	return q, nil
}

const visibleAlumni = `p.alumni_published and csc.alumni_eligible(p,extract(year from statement_timestamp() at time zone 'America/New_York')::integer)`
const directoryColumns = `p.id::text, concat_ws(' ',coalesce(p.preferred_name,p.first_name),p.last_name),p.graduation_year,
 p.location,p.bio,p.current_company,p.job_title,p.position_is_current,
 'https://www.linkedin.com/in/'||p.linkedin_username,p.contact_email,
 p.open_to_coffee_chats,p.open_to_mentorship,p.available_for_referrals,p.open_to_resume_review,p.alumni_updated_at`

func scanDirectory(row pgx.Row) (DirectoryRecord, error) {
	var d DirectoryRecord
	err := row.Scan(&d.ID, &d.FullName, &d.GraduationYear, &d.Location, &d.Bio, &d.CurrentCompany, &d.CurrentRole, &d.PositionIsCurrent,
		&d.LinkedInURL, &d.ContactEmail, &d.OpenToCoffeeChats, &d.OpenToMentorship, &d.AvailableForReferrals, &d.OpenToResumeReview, &d.UpdatedAt)
	return d, err
}
func (s Store) ListAlumni(ctx context.Context, q DirectoryQuery) (DirectoryPage, error) {
	result := DirectoryPage{Data: []DirectoryRecord{}}
	tx, err := s.DB.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	where := ` from csc.profiles p where ` + visibleAlumni + `
 and ($1='' or position(lower($1) in lower(concat_ws(' ',p.first_name,p.preferred_name,p.last_name,p.current_company,p.job_title)))>0)
 and ($2='' or lower(p.current_company)=lower($2)) and ($3='' or lower(p.location)=lower($3))
 and ($4=0 or p.graduation_year=$4) and (not $5 or p.open_to_coffee_chats)
 and (not $6 or p.open_to_mentorship) and (not $7 or p.available_for_referrals) and (not $8 or p.open_to_resume_review)`
	args := []any{q.Search, q.Company, q.Location, q.Year, q.Coffee, q.Mentorship, q.Referrals, q.Resume}
	if err = tx.QueryRow(ctx, `select count(*)`+where, args...).Scan(&result.Count); err != nil {
		return result, err
	}
	args = append(args, (q.Page-1)*20)
	rows, err := tx.Query(ctx, `select `+directoryColumns+where+` order by lower(p.last_name),lower(p.first_name),p.id limit 20 offset $9`, args...)
	if err != nil {
		return result, err
	}
	for rows.Next() {
		d, e := scanDirectory(rows)
		if e != nil {
			rows.Close()
			return result, e
		}
		result.Data = append(result.Data, d)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	result.HasMore = q.Page*20 < result.Count
	err = tx.QueryRow(ctx, `select coalesce(array_agg(distinct location order by location),'{}'),
 coalesce(array_agg(distinct current_company order by current_company),'{}'),
 coalesce(array_agg(distinct graduation_year order by graduation_year),'{}') from csc.profiles p where `+visibleAlumni).Scan(&result.Options.Locations, &result.Options.Companies, &result.Options.Years)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}

var directoryID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func (s Store) GetAlumnus(ctx context.Context, id string) (DirectoryRecord, error) {
	if !directoryID.MatchString(id) {
		return DirectoryRecord{}, ErrNotFound
	}
	d, err := scanDirectory(s.DB.QueryRow(ctx, `select `+directoryColumns+` from csc.profiles p where p.id=$1::uuid and `+visibleAlumni, id))
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return d, err
}
func (s Store) AlumniPhoto(ctx context.Context, id string) (Asset, error) {
	if !directoryID.MatchString(id) {
		return Asset{}, ErrNotFound
	}
	var a Asset
	err := s.DB.QueryRow(ctx, `select a.media_type,a.bytes,a.updated_at from csc.profiles p join csc.profile_assets a
 on a.id=p.avatar_asset_id and a.auth_user_id=p.auth_user_id and a.kind='avatar'
 where p.id=$1::uuid and `+visibleAlumni, id).Scan(&a.MediaType, &a.Bytes, &a.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return a, err
}
