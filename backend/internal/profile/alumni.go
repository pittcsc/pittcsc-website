package profile

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// ClaimAlumni is an idempotent self-attestation. The verified caller ID is the
// only target; no general role assignment is exposed through the profile API.
func (s Store) ClaimAlumni(ctx context.Context, authUserID string) (Record, error) {
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
	var active bool
	err = tx.QueryRow(ctx, `select p.account_status = 'active' and u.email_confirmed_at is not null
		and u.deleted_at is null and not u.is_anonymous
		and (u.banned_until is null or u.banned_until <= now())
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid for update of p`, authUserID).Scan(&active)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return Record{}, ErrSuspended
	}
	if err != nil {
		return Record{}, err
	}
	result, err := tx.Exec(ctx, `insert into csc.user_roles (auth_user_id, role)
		values ($1::uuid, 'alumni') on conflict do nothing`, authUserID)
	if err != nil {
		return Record{}, err
	}
	if result.RowsAffected() > 0 {
		if _, err := tx.Exec(ctx, `insert into csc.role_audit (target_user_id, role, action, actor_user_id)
			values ($1::uuid, 'alumni', 'grant', $1::uuid)`, authUserID); err != nil {
			return Record{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Record{}, err
	}
	return s.Get(ctx, authUserID)
}
