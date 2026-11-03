package events

import (
	"context"

	"github.com/pittcsc/pittcsc-website/backend/internal/points"
)

// foundryAccess reads current database-backed eligibility. The legacy foundry
// role is deliberately absent: points, an unexpired staff grant, or staff access
// qualify a completed active account for a Foundry event.
func foundryAccess(ctx context.Context, query rowQuerier, userID string) (bool, error) {
	var eligible bool
	err := query.QueryRow(ctx, `select
		exists (select 1 from csc.user_roles r where r.auth_user_id = $1::uuid and r.role = 'staff')
		or coalesce((select sum(c.points_awarded) from csc.point_claims c
			where c.auth_user_id = $1::uuid and c.status = 'awarded'
			and c.awarded_at >= now() - interval '720 hours'), 0) >= $2
		or exists (select 1 from csc.foundry_grants g where g.auth_user_id = $1::uuid
			and g.revoked_at is null and g.expires_at > now())`, userID, points.FoundryThreshold).Scan(&eligible)
	return eligible, err
}
