package profile

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

var (
	ErrMemberNotFound = errors.New("member not found")
	ErrInvalidSearch  = errors.New("invalid directory search")
)

const DirectoryPageSize = 24

// Eligibility is evaluated in Postgres for every read, including avatar bytes.
// Auth identity, status, and profile completion never come from the browser.
const activeMemberSQL = `p.account_status = 'active' and u.email_confirmed_at is not null
	and u.deleted_at is null and not u.is_anonymous
	and (u.banned_until is null or u.banned_until <= now())`
const completeMemberSQL = `p.first_name is not null and p.last_name is not null
	and p.graduation_year is not null and cardinality(p.majors) > 0`
const displayNameSQL = `concat_ws(' ', coalesce(p.preferred_name, p.first_name), p.last_name)`

type DirectoryMember struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	GraduationYear *int     `json:"graduationYear"`
	Majors         []string `json:"majors"`
	HasAvatar      bool     `json:"hasAvatar"`
	IsAlumni       bool     `json:"isAlumni"`
	CurrentCompany *string  `json:"currentCompany"`
	JobTitle       *string  `json:"jobTitle"`
}

type PublicMember struct {
	DirectoryMember
	GitHubUsername     *string `json:"githubUsername"`
	LeetCodeUsername   *string `json:"leetcodeUsername"`
	LinkedInUsername   *string `json:"linkedinUsername"`
	Location           *string `json:"location"`
	Bio                *string `json:"bio"`
	PersonalWebsite    *string `json:"personalWebsite"`
	ContactEmail       *string `json:"contactEmail"`
	OffersCoffee       bool    `json:"offersCoffee"`
	OffersMentorship   bool    `json:"offersMentorship"`
	OffersReferrals    bool    `json:"offersReferrals"`
	OffersResumeReview bool    `json:"offersResumeReview"`
	AllTimePoints      int     `json:"allTimePoints"`
	Rank30Days         *int    `json:"rank30Days"`
	Complete           bool    `json:"complete"`
}

type DirectoryPage struct {
	Members  []DirectoryMember `json:"members"`
	Total    int               `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
}

type DirectorySearch struct {
	Name    string
	Company string
	Alumni  bool
	Page    int
}

func ParseDirectorySearch(query, company, alumni, rawPage string) (DirectorySearch, error) {
	unsafe := func(value string) bool {
		return !utf8.ValidString(value) || strings.ContainsFunc(value, func(character rune) bool {
			return unicode.IsControl(character) && character != '\t'
		})
	}
	if unsafe(query) || unsafe(company) {
		return DirectorySearch{}, ErrInvalidSearch
	}
	search := DirectorySearch{Name: strings.Join(strings.Fields(query), " "), Company: strings.Join(strings.Fields(company), " "), Alumni: alumni == "1", Page: 1}
	if utf8.RuneCountInString(search.Name) > 100 || utf8.RuneCountInString(search.Company) > 160 ||
		(alumni != "" && alumni != "1") {
		return DirectorySearch{}, ErrInvalidSearch
	}
	if rawPage != "" {
		value, err := strconv.Atoi(rawPage)
		if err != nil || value < 1 || value > 10000 {
			return DirectorySearch{}, ErrInvalidSearch
		}
		search.Page = value
	}
	return search, nil
}

func (s Store) Directory(ctx context.Context, search DirectorySearch) (DirectoryPage, error) {
	result := DirectoryPage{Members: []DirectoryMember{}, Page: search.Page, PageSize: DirectoryPageSize}
	where := activeMemberSQL + ` and ` + completeMemberSQL + ` and
		($1 = '' or strpos(lower(concat_ws(' ', p.first_name, p.last_name)), lower($1)) > 0
		or strpos(lower(concat_ws(' ', p.preferred_name, p.last_name)), lower($1)) > 0)
		and ($2 = '' or (p.details_shared and strpos(lower(coalesce(p.current_company, '')), lower($2)) > 0))
		and (not $3 or exists(select 1 from csc.user_roles r
			where r.auth_user_id = p.auth_user_id and r.role = 'alumni')
			and p.graduation_year <= extract(year from statement_timestamp() at time zone 'America/New_York')::integer)`
	if err := s.DB.QueryRow(ctx, `select count(*) from csc.profiles p join auth.users u
		on u.id = p.auth_user_id where `+where, search.Name, search.Company, search.Alumni).Scan(&result.Total); err != nil {
		return DirectoryPage{}, err
	}
	rows, err := s.DB.Query(ctx, `select p.auth_user_id::text, `+displayNameSQL+`,
		p.graduation_year, p.majors, p.details_shared and p.avatar_asset_id is not null,
		exists(select 1 from csc.user_roles r where r.auth_user_id = p.auth_user_id and r.role = 'alumni')
		and p.graduation_year <= extract(year from statement_timestamp() at time zone 'America/New_York')::integer,
		case when p.details_shared then p.current_company end,
		case when p.details_shared then p.job_title end
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where `+where+` order by lower(`+displayNameSQL+`), p.auth_user_id
		limit $4 offset $5`, search.Name, search.Company, search.Alumni, DirectoryPageSize, (search.Page-1)*DirectoryPageSize)
	if err != nil {
		return DirectoryPage{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var member DirectoryMember
		if err := rows.Scan(&member.ID, &member.Name, &member.GraduationYear,
			&member.Majors, &member.HasAvatar, &member.IsAlumni, &member.CurrentCompany, &member.JobTitle); err != nil {
			return DirectoryPage{}, err
		}
		result.Members = append(result.Members, member)
	}
	return result, rows.Err()
}

// Staff may inspect an active but incomplete account from User Management.
func (s Store) PublicMember(ctx context.Context, memberID string, staff bool) (PublicMember, error) {
	var result PublicMember
	err := s.DB.QueryRow(ctx, `select p.auth_user_id::text, `+displayNameSQL+`,
		p.graduation_year, p.majors, p.details_shared and p.avatar_asset_id is not null,
		exists(select 1 from csc.user_roles r where r.auth_user_id = p.auth_user_id and r.role = 'alumni')
		and p.graduation_year <= extract(year from statement_timestamp() at time zone 'America/New_York')::integer,
		case when p.details_shared then p.current_company end,
		case when p.details_shared then p.job_title end,
		case when p.details_shared then p.github_username end,
		case when p.details_shared then p.leetcode_username end,
		case when p.details_shared then p.linkedin_username end,
		case when p.details_shared then p.location end,
		case when p.details_shared then p.bio end,
		case when p.details_shared then p.personal_website end,
		case when p.details_shared and lower(p.contact_email) is distinct from lower(u.email) then p.contact_email end,
		p.details_shared and p.offers_coffee,
		p.details_shared and p.offers_mentorship,
		p.details_shared and p.offers_referrals,
		p.details_shared and p.offers_resume_review,
		(`+completeMemberSQL+`)
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid and `+activeMemberSQL+`
		and ($2 or (`+completeMemberSQL+`))`, memberID, staff).
		Scan(&result.ID, &result.Name, &result.GraduationYear, &result.Majors,
			&result.HasAvatar, &result.IsAlumni, &result.CurrentCompany, &result.JobTitle,
			&result.GitHubUsername, &result.LeetCodeUsername, &result.LinkedInUsername,
			&result.Location, &result.Bio, &result.PersonalWebsite, &result.ContactEmail,
			&result.OffersCoffee, &result.OffersMentorship, &result.OffersReferrals, &result.OffersResumeReview,
			&result.Complete)
	if errors.Is(err, pgx.ErrNoRows) {
		return PublicMember{}, ErrMemberNotFound
	}
	if err != nil {
		return PublicMember{}, err
	}
	if err := s.DB.QueryRow(ctx, `select coalesce(sum(points_awarded), 0)::integer
		from csc.point_claims where auth_user_id = $1::uuid and status = 'awarded'`, memberID).
		Scan(&result.AllTimePoints); err != nil {
		return PublicMember{}, err
	}
	err = s.DB.QueryRow(ctx, `with scores as (
		select c.auth_user_id, sum(c.points_awarded) as points
		from csc.point_claims c join csc.profiles p on p.auth_user_id = c.auth_user_id
		join auth.users u on u.id = c.auth_user_id
		where c.status = 'awarded' and c.awarded_at >= now() - interval '30 days'
		and `+activeMemberSQL+` and `+completeMemberSQL+`
		group by c.auth_user_id
	), ranked as (
		select auth_user_id, rank() over (order by points desc)::integer as rank from scores
	) select rank from ranked where auth_user_id = $1::uuid`, memberID).Scan(&result.Rank30Days)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, nil
	}
	return result, err
}

func (s Store) MemberAvatar(ctx context.Context, memberID string, staff bool) (Asset, error) {
	var asset Asset
	err := s.DB.QueryRow(ctx, `select a.media_type, a.bytes, a.updated_at
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		join csc.profile_assets a on a.id = p.avatar_asset_id and a.auth_user_id = p.auth_user_id
		where p.auth_user_id = $1::uuid and `+activeMemberSQL+`
		and p.details_shared and ($2 or (`+completeMemberSQL+`))`, memberID, staff).
		Scan(&asset.MediaType, &asset.Bytes, &asset.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrMemberNotFound
	}
	return asset, err
}
