# CRM points

Active accounts can submit a category, an HTTPS link, and an affirmation on
**Points** (`/dashboard/points`). Each accepted link awards 10 points
immediately. Current categories are a public LeetCode solution, a research
paper read, and a public GitHub PR or standalone commit. A PR and its included
commits count as one contribution. There is no earning cap.

This first release uses the honor system for authorship, reading, PR/commit
overlap, and public reachability. The API checks URL format and supported hosts
but does not fetch external pages. Points should receive a separate verification
decision before they become a Foundry role requirement.

## Scores and visibility

- Points and My Account show the owner's all-time and rolling 30-day scores,
  claim links, dates, and statuses. Staff can inspect claims in their
  moderation tool. Other members cannot see links or private profiles.
- Signed-in users see the top 10 active accounts with points on each leaderboard,
  plus their own rank if outside the top 10. Only names and scores are shown.
- The rolling period is the preceding 30 days measured from the original award
  time. Submitting old work today awards points today. Restoring a claim keeps
  the original award time. Suspended accounts retain claims but leave the boards.
- Withdrawn and revoked claims contribute zero points. Owners can withdraw a
  claim; staff can revoke, restore, or correct one with an audit reason. Revoked
  reasons are visible to the owner.

## Data and authorization

`csc.point_categories` stores category labels and current values.
`csc.point_claims` stores the verified owner, category, normalized link,
original award time, points awarded, and current status. Keeping
`points_awarded` on each claim preserves historical rates if a category changes.
`csc.point_claim_links` reserves every normalized link a person has claimed,
including old links after staff corrections; each person can claim a link only
once for its lifetime and across categories. Different people may claim the same
link. `csc.point_claim_audit` records status and correction changes. Database
uniqueness makes concurrent submissions safe.

All four tables are in the private `csc` schema with RLS enabled and no browser
role grants. The Go API verifies the bearer token and current account status on
every request, derives ownership from the verified identity, and checks the
current staff role for moderation. Neither submitted roles nor user IDs grant
access. The public Gatsby build contains no point or claim data.

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /points/categories` | Active account | Current activity choices and values |
| `GET /points/me?page=1` | Owner | Scores and 20 newest claims per page |
| `POST /points/claims` | Active account | Submit `{category,url,affirmed:true}` |
| `DELETE /points/claims/{id}` | Owner | Withdraw an awarded claim |
| `GET /points/leaderboard?period=all\|30d` | Active account | Top 10 and own rank |
| `GET /staff/points/claims?page=1` | Staff | 20 newest claims per page |
| `POST /staff/points/claims/{id}/revoke` | Staff | Revoke with `{reason}` |
| `POST /staff/points/claims/{id}/restore` | Staff | Restore with `{reason}` |
| `PUT /staff/points/claims/{id}` | Staff | Correct with `{category,url,reason}` |

The current URL rules accept `leetcode.com/problems/.../solutions/{id}` for
LeetCode, `github.com/{owner}/{repo}/pull/{number}` or
`github.com/{owner}/{repo}/commit/{hash}` for project contributions, and any
HTTPS URL for a paper. Simple variants such as fragments, trailing slashes,
tracking parameters, and GitHub URL subpages normalize to one link. Paper
links retain meaningful query parameters. This is not a semantic duplicate
check: alternate sites or URLs for the same work need staff review.

## Local verification

Apply the migration only to the local Supabase database, then run:

```sh
mise run check
mise run build
mise run test:points
docker exec -i supabase_db_pittcsc-website psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/points.sql
```

`backend/internal/points/store_integration_test.go` exercises concurrent
claims, duplicate links, score changes, moderation, audit entries, and
corrections against a **synthetic active local** Auth/profile fixture when
`POINTS_TEST_DATABASE_URL` and `POINTS_TEST_USER_ID` are set. It refuses a
non-loopback database and skips in the regular check suite when no fixture is
configured. The test removes its own claim afterward.

Hosted migration and deployment are separate operations. Apply the migration
to each intended environment only after reviewing it there; do not mix local,
staging, or production credentials or data.
