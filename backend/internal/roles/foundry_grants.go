package roles

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

func ValidGrantRequestID(value string) bool { return uuidPattern.MatchString(value) }

// ChangeFoundryGrant creates, renews, or revokes a 30-day exception. Request IDs
// identify a button press so retries cannot silently extend a grant twice.
func (s Store) ChangeFoundryGrant(ctx context.Context, actorID, targetID, requestID string, grant bool) (Member, error) {
	if !uuidPattern.MatchString(targetID) {
		return Member{}, ErrNotFound
	}
	if !ValidGrantRequestID(requestID) {
		return Member{}, ErrInvalidGrant
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Member{}, err
	}
	defer tx.Rollback(ctx)
	// Grant operations are serialized across instances. The profile locks also
	// coordinate with suspension and staff-role changes.
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext('csc.foundry_grants'))`); err != nil {
		return Member{}, err
	}
	var actor string
	err = tx.QueryRow(ctx, `select p.auth_user_id::text from csc.profiles p
		join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid and `+eligible+`
		and exists (select 1 from csc.user_roles r where r.auth_user_id = p.auth_user_id and r.role = 'staff')
		for share of p`, actorID).Scan(&actor)
	if errors.Is(err, pgx.ErrNoRows) {
		return Member{}, ErrForbidden
	}
	if err != nil {
		return Member{}, err
	}
	var target string
	err = tx.QueryRow(ctx, `select p.auth_user_id::text from csc.profiles p
		join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid and `+eligible+` for update of p`, targetID).Scan(&target)
	if errors.Is(err, pgx.ErrNoRows) {
		return Member{}, ErrNotFound
	}
	if err != nil {
		return Member{}, err
	}
	action := "revoke"
	if grant {
		action = "grant"
	}
	var previousTarget, previousAction string
	err = tx.QueryRow(ctx, `select target_user_id::text, action from csc.foundry_grant_audit
		where request_id = $1::uuid`, requestID).Scan(&previousTarget, &previousAction)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Member{}, err
	}
	if err == nil && (previousTarget != targetID || previousAction != action) {
		return Member{}, ErrInvalidGrant
	}
	if errors.Is(err, pgx.ErrNoRows) {
		var grantedAt, expiresAt time.Time
		if grant {
			err = tx.QueryRow(ctx, `insert into csc.foundry_grants
				(auth_user_id, granted_at, expires_at) values ($1::uuid, now(), now() + interval '720 hours')
				on conflict (auth_user_id) do update set granted_at = excluded.granted_at,
					expires_at = excluded.expires_at, revoked_at = null
				returning granted_at, expires_at`, targetID).Scan(&grantedAt, &expiresAt)
		} else {
			err = tx.QueryRow(ctx, `update csc.foundry_grants set revoked_at = now()
				where auth_user_id = $1::uuid and revoked_at is null and expires_at > now()
				returning granted_at, expires_at`, targetID).Scan(&grantedAt, &expiresAt)
		}
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return Member{}, err
		}
		if err == nil {
			_, err = tx.Exec(ctx, `insert into csc.foundry_grant_audit
				(request_id, target_user_id, actor_user_id, action, granted_at, expires_at)
				values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
				requestID, targetID, actorID, action, grantedAt, expiresAt)
			if err != nil {
				return Member{}, err
			}
		}
	}
	member, err := scanMember(tx.QueryRow(ctx, `select `+memberColumns+`
		from csc.profiles p join auth.users u on u.id = p.auth_user_id
		where p.auth_user_id = $1::uuid`, targetID))
	if err != nil {
		return Member{}, err
	}
	return member, tx.Commit(ctx)
}
