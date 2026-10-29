package profile

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// SetDetailsShared records the verified owner's explicit sharing choice.
// The row update and migration trigger serialize with profile/status changes.
func (s Store) SetDetailsShared(ctx context.Context, authUserID string, shared bool) (Record, error) {
	var id string
	err := s.DB.QueryRow(ctx, `update csc.profiles set details_shared = $2
		where auth_user_id = $1::uuid and account_status = 'active'
		and first_name is not null and last_name is not null
		and graduation_year is not null and cardinality(majors) > 0
		returning id::text`, authUserID, shared).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		record, lookupErr := s.Get(ctx, authUserID)
		if lookupErr != nil {
			return Record{}, lookupErr
		}
		if !record.Complete {
			return Record{}, ErrIncomplete
		}
		return Record{}, ErrInvalid
	}
	if err != nil {
		return Record{}, err
	}
	return s.Get(ctx, authUserID)
}
