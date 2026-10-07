package roles

import (
	"context"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidSearch = errors.New("invalid member search")
	ErrUnknownRole   = errors.New("unknown role")
	ErrReadOnlyRole  = errors.New("role cannot be changed from the dashboard")
	ErrForbidden     = errors.New("actor may not change this role")
	ErrNotFound      = errors.New("no eligible account")
	ErrSelfRevoke    = errors.New("cannot revoke a protected role from yourself")
	ErrLastHolder    = errors.New("cannot remove the last active holder of a protected role")
)

const PageSize = 25

// eligible matches active, verified, non-deleted accounts. It expects profile
// alias p and Auth user alias u.
const eligible = `p.account_status = 'active' and u.email_confirmed_at is not null
	and u.deleted_at is null and not u.is_anonymous
	and (u.banned_until is null or u.banned_until <= now())`

var (
	uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	rolePattern = regexp.MustCompile(`^[a-z]{1,30}$`)
	likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
)

type Role struct {
	Name        string `json:"name"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Editable    bool   `json:"editable"`
	Confirm     bool   `json:"confirm"`
}

type Member struct {
	ID             string   `json:"id"`
	Email          string   `json:"email"`
	FirstName      *string  `json:"firstName"`
	LastName       *string  `json:"lastName"`
	PreferredName  *string  `json:"preferredName"`
	GraduationYear *int     `json:"graduationYear"`
	Roles          []string `json:"roles"`
}

type Search struct {
	Query string
	Role  string
	Page  int
}

type Page struct {
	Users    []Member `json:"users"`
	Total    int      `json:"total"`
	Page     int      `json:"page"`
	PageSize int      `json:"pageSize"`
}

// ParseSearch validates browser-supplied search parameters.
func ParseSearch(query, role, page string) (Search, error) {
	search := Search{Query: strings.Join(strings.Fields(query), " "), Role: role, Page: 1}
	if !utf8.ValidString(search.Query) || utf8.RuneCountInString(search.Query) > 100 || strings.ContainsFunc(search.Query, unicode.IsControl) {
		return Search{}, ErrInvalidSearch
	}
	if role != "" && !rolePattern.MatchString(role) {
		return Search{}, ErrInvalidSearch
	}
	if page != "" {
		n, err := strconv.Atoi(page)
		if err != nil || n < 1 || n > 10000 {
			return Search{}, ErrInvalidSearch
		}
		search.Page = n
	}
	return search, nil
}

type Store struct{ DB *pgxpool.Pool }

// Catalog lists every role with whether this actor may change it.
func (s Store) Catalog(ctx context.Context, actorRoles []string) ([]Role, error) {
	rows, err := s.DB.Query(ctx, `select name, label, description from csc.roles order by label`)
	if err != nil {
		return nil, err
	}
	catalog, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Role, error) {
		var role Role
		err := row.Scan(&role.Name, &role.Label, &role.Description)
		role.Editable = CanManage(actorRoles, role.Name)
		role.Confirm = Policy[role.Name].Confirm
		return role, err
	})
	return catalog, err
}

const memberColumns = `p.auth_user_id::text, coalesce(u.email, ''), p.first_name, p.last_name,
	p.preferred_name, p.graduation_year,
	array(select r.role from csc.user_roles r where r.auth_user_id = p.auth_user_id order by r.role)`

func scanMember(row pgx.Row, extra ...any) (Member, error) {
	var m Member
	err := row.Scan(append([]any{&m.ID, &m.Email, &m.FirstName, &m.LastName, &m.PreferredName, &m.GraduationYear, &m.Roles}, extra...)...)
	return m, err
}

// Search pages through active accounts by email or name, optionally by role.
func (s Store) Search(ctx context.Context, search Search) (Page, error) {
	if search.Role != "" {
		var exists bool
		if err := s.DB.QueryRow(ctx, `select exists (select 1 from csc.roles where name = $1)`, search.Role).Scan(&exists); err != nil {
			return Page{}, err
		}
		if !exists {
			return Page{}, ErrInvalidSearch
		}
	}
	var pattern *string
	if search.Query != "" {
		value := "%" + likeEscaper.Replace(search.Query) + "%"
		pattern = &value
	}
	rows, err := s.DB.Query(ctx, `
		select `+memberColumns+`, count(*) over ()
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where `+eligible+`
		  and ($1::text is null or u.email ilike $1 or p.first_name ilike $1
		    or p.last_name ilike $1 or p.preferred_name ilike $1
		    or concat_ws(' ', p.first_name, p.last_name) ilike $1
		    or concat_ws(' ', p.preferred_name, p.last_name) ilike $1)
		  and ($2 = '' or exists (select 1 from csc.user_roles r
		    where r.auth_user_id = p.auth_user_id and r.role = $2))
		order by lower(p.last_name) nulls last, lower(u.email), p.auth_user_id
		limit $3 offset $4
	`, pattern, search.Role, PageSize, (search.Page-1)*PageSize)
	if err != nil {
		return Page{}, err
	}
	result := Page{Users: []Member{}, Page: search.Page, PageSize: PageSize}
	for rows.Next() {
		m, err := scanMember(rows, &result.Total)
		if err != nil {
			rows.Close()
			return Page{}, err
		}
		result.Users = append(result.Users, m)
	}
	return result, rows.Err()
}

// Change grants or revokes one role for a dashboard actor. Retries and
// concurrent requests converge: only an actual change writes an audit row.
func (s Store) Change(ctx context.Context, actorID, targetID, role string, grant bool) (Member, error) {
	if !uuidPattern.MatchString(targetID) {
		return Member{}, ErrNotFound
	}
	if !rolePattern.MatchString(role) {
		return Member{}, ErrUnknownRole
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Member{}, err
	}
	defer tx.Rollback(ctx)
	// Serialize role changes so protected-role holder counts cannot race.
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext('csc.role_changes'))`); err != nil {
		return Member{}, err
	}
	var exists bool
	if err := tx.QueryRow(ctx, `select exists (select 1 from csc.roles where name = $1)`, role).Scan(&exists); err != nil {
		return Member{}, err
	}
	if !exists {
		return Member{}, ErrUnknownRole
	}
	rule, ok := Policy[role]
	if !ok {
		return Member{}, ErrReadOnlyRole
	}
	// Recheck the actor under the lock: a concurrent revoke or suspension
	// after the request's staff check must not let them keep changing roles.
	var actorRoles []string
	err = tx.QueryRow(ctx, `
		select array(select r.role from csc.user_roles r where r.auth_user_id = p.auth_user_id)
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid and `+eligible, actorID).Scan(&actorRoles)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !CanManage(actorRoles, role)) {
		return Member{}, ErrForbidden
	}
	if err != nil {
		return Member{}, err
	}
	var holds bool
	err = tx.QueryRow(ctx, `
		select exists (select 1 from csc.user_roles r where r.auth_user_id = p.auth_user_id and r.role = $2)
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid and `+eligible+`
		for update of p`, targetID, role).Scan(&holds)
	if errors.Is(err, pgx.ErrNoRows) {
		return Member{}, ErrNotFound
	}
	if err != nil {
		return Member{}, err
	}
	if !grant && holds && rule.Protected {
		if targetID == actorID {
			return Member{}, ErrSelfRevoke
		}
		var holders int
		err = tx.QueryRow(ctx, `
			select count(*) from csc.user_roles r
			join csc.profiles p on p.auth_user_id = r.auth_user_id
			join auth.users u on u.id = p.auth_user_id
			where r.role = $1 and `+eligible, role).Scan(&holders)
		if err != nil {
			return Member{}, err
		}
		if holders <= 1 {
			return Member{}, ErrLastHolder
		}
	}
	if grant != holds {
		action, query := "grant", `insert into csc.user_roles (auth_user_id, role) values ($1::uuid, $2)`
		if !grant {
			action, query = "revoke", `delete from csc.user_roles where auth_user_id = $1::uuid and role = $2`
		}
		if _, err := tx.Exec(ctx, query, targetID, role); err != nil {
			return Member{}, err
		}
		_, err = tx.Exec(ctx, `insert into csc.role_audit (target_user_id, role, action, actor_user_id) values ($1::uuid, $2, $3, $4::uuid)`, targetID, role, action, actorID)
		if err != nil {
			return Member{}, err
		}
	}
	member, err := scanMember(tx.QueryRow(ctx, `
		select `+memberColumns+`
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid`, targetID))
	if err != nil {
		return Member{}, err
	}
	return member, tx.Commit(ctx)
}
