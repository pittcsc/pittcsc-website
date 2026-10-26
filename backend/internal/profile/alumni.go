package profile

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

var ErrAlumniYear = errors.New("graduation year is not eligible for alumni status")

// ClaimAlumni is an idempotent self-attestation. The verified caller ID is the
// only target; no general role assignment is exposed through the profile API.
func (s Store) ClaimAlumni(ctx context.Context, authUserID string) (Record, error) {
	return s.changeAlumni(ctx, authUserID, true)
}

// UnclaimAlumni removes only the verified owner's alumni label. It remains
// available even if the graduation year has since become ineligible.
func (s Store) UnclaimAlumni(ctx context.Context, authUserID string) (Record, error) {
	return s.changeAlumni(ctx, authUserID, false)
}

func (s Store) changeAlumni(ctx context.Context, authUserID string, grant bool) (Record, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Record{}, err
	}
	defer tx.Rollback(ctx)
	// Staff role changes use the same lock. Concurrent grants and retries write
	// at most one assignment and audit row.
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext('csc.role_changes'))`); err != nil {
		return Record{}, err
	}
	var active, eligible, holds bool
	err = tx.QueryRow(ctx, `select p.account_status = 'active' and u.email_confirmed_at is not null
		and u.deleted_at is null and not u.is_anonymous
		and (u.banned_until is null or u.banned_until <= now()),
		coalesce(p.graduation_year <= extract(year from statement_timestamp() at time zone 'America/New_York')::integer, false),
		exists(select 1 from csc.user_roles r where r.auth_user_id = p.auth_user_id and r.role = 'alumni')
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid for update of p`, authUserID).Scan(&active, &eligible, &holds)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return Record{}, ErrSuspended
	}
	if err != nil {
		return Record{}, err
	}
	if grant && !eligible && !holds {
		return Record{}, ErrAlumniYear
	}
	action := "grant"
	query := `insert into csc.user_roles (auth_user_id, role)
		values ($1::uuid, 'alumni') on conflict do nothing`
	if !grant {
		action = "revoke"
		query = `delete from csc.user_roles where auth_user_id = $1::uuid and role = 'alumni'`
	}
	result, err := tx.Exec(ctx, query, authUserID)
	if err != nil {
		return Record{}, err
	}
	if result.RowsAffected() > 0 {
		if _, err := tx.Exec(ctx, `insert into csc.role_audit (target_user_id, role, action, actor_user_id)
			values ($1::uuid, 'alumni', $2, $1::uuid)`, authUserID, action); err != nil {
			return Record{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Record{}, err
	}
	return s.Get(ctx, authUserID)
}
