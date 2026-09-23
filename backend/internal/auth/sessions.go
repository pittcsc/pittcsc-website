package auth

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type Querier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}
type PostgresSessions struct{ DB Querier }

func (s PostgresSessions) Lookup(ctx context.Context, userID, sessionID string) (Identity, error) {
	var identity Identity
	// Read only Supabase-managed records. Auth remains the sole owner of session
	// creation, refresh, and deletion. Check the current email as well as JWT claims.
	err := s.DB.QueryRow(ctx, `
		select u.id::text, u.email
		from auth.sessions s join auth.users u on u.id = s.user_id
		where s.id = $1::uuid and u.id = $2::uuid
		  and (s.not_after is null or s.not_after > now())
		  and u.email_confirmed_at is not null
		  and (u.banned_until is null or u.banned_until <= now())
		  and u.deleted_at is null and not u.is_anonymous
	`, sessionID, userID).Scan(&identity.ID, &identity.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return Identity{}, ErrUnauthorized
	}
	if err != nil {
		return Identity{}, ErrUnavailable
	}
	return identity, nil
}
