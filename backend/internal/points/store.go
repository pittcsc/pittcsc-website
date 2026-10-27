package points

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ DB *pgxpool.Pool }

func scanClaim(row pgx.Row) (Claim, error) {
	var c Claim
	err := row.Scan(&c.ID, &c.Category, &c.URL, &c.Points, &c.Status, &c.AwardedAt, &c.ChangedAt, &c.StatusReason)
	return c, err
}

const claimColumns = `id, category_code, url, points_awarded, status, awarded_at, changed_at, status_reason`

func (s Store) Categories(ctx context.Context) ([]Category, error) {
	rows, err := s.DB.Query(ctx, `select code, label, points from csc.point_categories where active order by code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Category{}
	for rows.Next() {
		var item Category
		if err := rows.Scan(&item.Code, &item.Label, &item.Points); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s Store) Create(ctx context.Context, userID string, input Input) (Claim, error) {
	if !input.Affirmed {
		return Claim{}, ErrInvalid
	}
	normalized, err := NormalizeURL(input.Category, input.URL)
	if err != nil {
		return Claim{}, err
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Claim{}, err
	}
	defer tx.Rollback(ctx)
	claim, err := scanClaim(tx.QueryRow(ctx, `
		insert into csc.point_claims (auth_user_id, category_code, url, normalized_url, points_awarded)
		select $1::uuid, code, $3, $3, points from csc.point_categories
		where code = $2 and active
		returning `+claimColumns, userID, input.Category, normalized))
	if errors.Is(err, pgx.ErrNoRows) {
		return Claim{}, ErrInvalid
	}
	if isUnique(err) {
		return Claim{}, ErrDuplicate
	}
	if err != nil {
		return Claim{}, err
	}
	_, err = tx.Exec(ctx, `insert into csc.point_claim_links (auth_user_id, normalized_url, claim_id)
		values ($1::uuid, $2, $3::uuid)`, userID, normalized, claim.ID)
	if isUnique(err) {
		return Claim{}, ErrDuplicate
	}
	if err != nil {
		return Claim{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Claim{}, err
	}
	return claim, nil
}

func (s Store) Mine(ctx context.Context, userID string, page int) (Mine, error) {
	result := Mine{Claims: []Claim{}}
	err := s.DB.QueryRow(ctx, `
		select coalesce(sum(points_awarded), 0)::integer,
		  coalesce(sum(points_awarded) filter (where awarded_at >= now() - interval '30 days'), 0)::integer
		from csc.point_claims where auth_user_id = $1::uuid and status = 'awarded'
	`, userID).Scan(&result.AllTime, &result.Last30Days)
	if err != nil {
		return Mine{}, err
	}
	rows, err := s.DB.Query(ctx, `select `+claimColumns+` from csc.point_claims
		where auth_user_id = $1::uuid order by awarded_at desc, id desc limit $2 offset $3`,
		userID, PageSize+1, (page-1)*PageSize)
	if err != nil {
		return Mine{}, err
	}
	defer rows.Close()
	for rows.Next() {
		claim, err := scanClaim(rows)
		if err != nil {
			return Mine{}, err
		}
		if len(result.Claims) == PageSize {
			result.HasMore = true
			break
		}
		result.Claims = append(result.Claims, claim)
	}
	return result, rows.Err()
}

// Foundry totals the owner's awarded points over the same rolling window as
// the 30-day leaderboard. Restored claims keep their original award time.
//
// Walking claims newest first, the first one whose running total reaches the
// threshold is the oldest claim the status depends on; it lapses once that
// claim leaves the window.
func (s Store) Foundry(ctx context.Context, userID string) (FoundryStatus, error) {
	var name string
	var total int
	var activeUntil *time.Time
	err := s.DB.QueryRow(ctx, `
		with recent as (
		  select awarded_at,
		    sum(points_awarded) over (order by awarded_at desc, id desc) as running
		  from csc.point_claims
		  where auth_user_id = $1::uuid and status = 'awarded'
		    and awarded_at >= now() - make_interval(days => $3)
		)
		select coalesce(nullif(btrim(concat_ws(' ', coalesce(p.preferred_name, p.first_name), p.last_name)), ''), 'CSC member'),
		  (select coalesce(max(running), 0)::integer from recent),
		  (select max(awarded_at) + make_interval(days => $3) from recent where running >= $2)
		from csc.profiles p
		where p.auth_user_id = $1::uuid
	`, userID, FoundryThreshold, FoundryWindowDays).Scan(&name, &total, &activeUntil)
	if errors.Is(err, pgx.ErrNoRows) {
		return FoundryStatus{}, ErrNotFound
	}
	if err != nil {
		return FoundryStatus{}, err
	}
	return NewFoundryStatus(name, total, activeUntil), nil
}

func (s Store) Leaderboard(ctx context.Context, userID, period string) (Leaderboard, error) {
	if period != "all" && period != "30d" {
		return Leaderboard{}, ErrInvalid
	}
	result := Leaderboard{Period: period, Entries: []Standing{}}
	rows, err := s.DB.Query(ctx, `
		with totals as (
		  select p.auth_user_id,
		    coalesce(nullif(btrim(concat_ws(' ', coalesce(p.preferred_name, p.first_name), p.last_name)), ''), 'CSC member') as name,
		    sum(c.points_awarded)::integer as points
		  from csc.point_claims c join csc.profiles p on p.auth_user_id = c.auth_user_id
		  join auth.users u on u.id = c.auth_user_id
		  where p.account_status = 'active' and u.email_confirmed_at is not null
		    and u.deleted_at is null and not u.is_anonymous
		    and (u.banned_until is null or u.banned_until <= now())
		    and p.first_name is not null and p.last_name is not null
		    and p.graduation_year is not null and cardinality(p.majors) > 0
		    and c.status = 'awarded'
		    and ($2 = 'all' or c.awarded_at >= now() - interval '30 days')
		  group by p.auth_user_id, p.preferred_name, p.first_name, p.last_name
		), ranked as (
		  select auth_user_id, name, points, rank() over (order by points desc)::integer as rank,
		    row_number() over (order by points desc, name, auth_user_id)::integer as place
		  from totals
		)
		select auth_user_id::text, auth_user_id = $1::uuid, name, points, rank, place from ranked
		where place <= 10 or auth_user_id = $1::uuid order by place
	`, userID, period)
	if err != nil {
		return Leaderboard{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item Standing
		var place int
		if err := rows.Scan(&item.ID, &item.IsYou, &item.Name, &item.Points, &item.Rank, &place); err != nil {
			return Leaderboard{}, err
		}
		if place <= 10 {
			result.Entries = append(result.Entries, item)
		} else if item.IsYou {
			copy := item
			result.Own = &copy
		}
	}
	return result, rows.Err()
}

func (s Store) StaffList(ctx context.Context, page int) (StaffPage, error) {
	result := StaffPage{Claims: []Claim{}}
	rows, err := s.DB.Query(ctx, `select c.`+claimColumns+`, c.auth_user_id,
		coalesce(nullif(btrim(concat_ws(' ', coalesce(p.preferred_name, p.first_name), p.last_name)), ''), 'CSC member')
		from csc.point_claims c join csc.profiles p on p.auth_user_id = c.auth_user_id
		order by c.awarded_at desc, c.id desc limit $1 offset $2`, PageSize+1, (page-1)*PageSize)
	if err != nil {
		return StaffPage{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var claim Claim
		if err := rows.Scan(&claim.ID, &claim.Category, &claim.URL, &claim.Points, &claim.Status,
			&claim.AwardedAt, &claim.ChangedAt, &claim.StatusReason, &claim.MemberID, &claim.MemberName); err != nil {
			return StaffPage{}, err
		}
		if len(result.Claims) == PageSize {
			result.HasMore = true
			break
		}
		result.Claims = append(result.Claims, claim)
	}
	return result, rows.Err()
}

func (s Store) Withdraw(ctx context.Context, userID, claimID string) (Claim, error) {
	return s.change(ctx, userID, claimID, userID, "withdraw", "")
}

func (s Store) Moderate(ctx context.Context, actorID, claimID, action, reason string) (Claim, error) {
	if action != "revoke" && action != "restore" {
		return Claim{}, ErrInvalid
	}
	reason, err := ValidReason(reason)
	if err != nil {
		return Claim{}, err
	}
	return s.change(ctx, actorID, claimID, "", action, reason)
}

func (s Store) change(ctx context.Context, actorID, claimID, ownerID, action, reason string) (Claim, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Claim{}, err
	}
	defer tx.Rollback(ctx)
	query := `select ` + claimColumns + ` from csc.point_claims where id = $1::uuid`
	args := []any{claimID}
	if ownerID != "" {
		query += ` and auth_user_id = $2::uuid`
		args = append(args, ownerID)
	}
	old, err := scanClaim(tx.QueryRow(ctx, query+` for update`, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return Claim{}, ErrNotFound
	}
	if err != nil {
		return Claim{}, err
	}
	status := map[string]string{"withdraw": "withdrawn", "revoke": "revoked", "restore": "awarded"}[action]
	if old.Status == status {
		return old, nil
	}
	if action == "withdraw" && old.Status != "awarded" {
		return Claim{}, ErrConflict
	}
	if action == "restore" && old.Status == "awarded" {
		return old, nil
	}
	var statusReason any
	if action == "revoke" {
		statusReason = reason
	}
	claim, err := scanClaim(tx.QueryRow(ctx, `update csc.point_claims
		set status = $2, status_reason = $3, status_actor = $4::uuid, changed_at = now()
		where id = $1::uuid returning `+claimColumns, claimID, status, statusReason, actorID))
	if err != nil {
		return Claim{}, err
	}
	if err := insertAudit(ctx, tx, claimID, actorID, action, reason, old, claim); err != nil {
		return Claim{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Claim{}, err
	}
	return claim, nil
}

func (s Store) Correct(ctx context.Context, actorID, claimID string, input Correction) (Claim, error) {
	reason, err := ValidReason(input.Reason)
	if err != nil {
		return Claim{}, err
	}
	normalized, err := NormalizeURL(input.Category, input.URL)
	if err != nil {
		return Claim{}, err
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Claim{}, err
	}
	defer tx.Rollback(ctx)
	old, err := scanClaim(tx.QueryRow(ctx, `select `+claimColumns+` from csc.point_claims where id = $1::uuid for update`, claimID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Claim{}, ErrNotFound
	}
	if err != nil {
		return Claim{}, err
	}
	if old.Category == input.Category && old.URL == normalized {
		return old, nil
	}
	_, err = tx.Exec(ctx, `insert into csc.point_claim_links (auth_user_id, normalized_url, claim_id)
		select auth_user_id, $2, id from csc.point_claims where id = $1::uuid
		on conflict (auth_user_id, normalized_url) do nothing`, claimID, normalized)
	if err != nil {
		return Claim{}, err
	}
	var linkClaimID string
	err = tx.QueryRow(ctx, `select l.claim_id from csc.point_claim_links l
		join csc.point_claims c on c.auth_user_id = l.auth_user_id
		where c.id = $1::uuid and l.normalized_url = $2`, claimID, normalized).Scan(&linkClaimID)
	if err != nil {
		return Claim{}, err
	}
	if linkClaimID != claimID {
		return Claim{}, ErrDuplicate
	}
	claim, err := scanClaim(tx.QueryRow(ctx, `update csc.point_claims c
		set category_code = v.code, url = $2, normalized_url = $2,
		  points_awarded = case when c.category_code = v.code then c.points_awarded else v.points end,
		  changed_at = now(), status_actor = $4::uuid
		from csc.point_categories v
		where c.id = $1::uuid and v.code = $3 and v.active
		returning c.`+claimColumns, claimID, normalized, input.Category, actorID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Claim{}, ErrInvalid
	}
	if isUnique(err) {
		return Claim{}, ErrDuplicate
	}
	if err != nil {
		return Claim{}, err
	}
	if err := insertAudit(ctx, tx, claimID, actorID, "correct", reason, old, claim); err != nil {
		return Claim{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Claim{}, err
	}
	return claim, nil
}

func insertAudit(ctx context.Context, tx pgx.Tx, claimID, actorID, action, reason string, old, claim Claim) error {
	before, err := json.Marshal(old)
	if err != nil {
		return err
	}
	after, err := json.Marshal(claim)
	if err != nil {
		return err
	}
	var why any
	if reason != "" {
		why = reason
	}
	_, err = tx.Exec(ctx, `insert into csc.point_claim_audit
		(claim_id, actor_user_id, action, reason, old_claim, new_claim)
		values ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb)`, claimID, actorID, action, why, before, after)
	return err
}

func isUnique(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
