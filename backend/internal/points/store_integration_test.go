package points

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Set these only for a local synthetic Auth/profile fixture. The regular check
// suite runs the pure validation and HTTP authorization tests without Docker.
func TestStoreIntegration(t *testing.T) {
	dsn, userID := os.Getenv("POINTS_TEST_DATABASE_URL"), os.Getenv("POINTS_TEST_USER_ID")
	if dsn == "" || userID == "" {
		t.Skip("local synthetic points fixture not configured")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost" && u.Hostname() != "::1") {
		t.Fatal("nonlocal database refused")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	var email string
	err = pool.QueryRow(ctx, `select u.email from auth.users u join csc.profiles p on p.auth_user_id = u.id
		where u.id = $1::uuid and p.account_status = 'active'`, userID).Scan(&email)
	if err != nil {
		t.Fatalf("fixture lookup failed: %v", err)
	}
	if !strings.HasPrefix(email, "csc-") || !strings.Contains(email, "test-") || !strings.HasSuffix(email, "@pitt.edu") {
		t.Fatal("synthetic active profile required")
	}
	s := Store{DB: pool}
	base, err := s.Mine(ctx, userID, 1)
	if err != nil {
		t.Fatal(err)
	}
	baseFoundry, err := s.Foundry(ctx, userID, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	monthStart, _ := ClubMonth(time.Now())
	previousMonth := monthStart.Add(-time.Second)
	basePrevious, err := s.Foundry(ctx, userID, previousMonth)
	if err != nil {
		t.Fatal(err)
	}
	categories, err := s.Categories(ctx)
	if err != nil || len(categories) < 3 {
		t.Fatal("point categories missing")
	}
	firstURL := fmt.Sprintf("https://example.org/csc-points-test/%d", time.Now().UnixNano())
	input := Input{Category: "paper", URL: firstURL + "?utm_source=first", Affirmed: true}
	claims := make(chan Claim, 2)
	errorsCh := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); claim, err := s.Create(ctx, userID, input); claims <- claim; errorsCh <- err }()
	}
	wg.Wait()
	close(claims)
	close(errorsCh)
	var created Claim
	for claim := range claims {
		if claim.ID != "" {
			created = claim
		}
	}
	if created.ID == "" {
		t.Fatal("concurrent claim was not created")
	}
	t.Cleanup(func() {
		cleanupCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		if _, err := pool.Exec(cleanupCtx, `delete from csc.point_claims where id = $1::uuid`, created.ID); err != nil {
			t.Errorf("clean synthetic point claim: %v", err)
		}
	})
	var successes, duplicates int
	for err := range errorsCh {
		if err == nil {
			successes++
		} else if errors.Is(err, ErrDuplicate) {
			duplicates++
		} else {
			t.Fatal(err)
		}
	}
	if successes != 1 || duplicates != 1 {
		t.Fatalf("concurrent claims: %d success, %d duplicate", successes, duplicates)
	}
	if _, err := s.Create(ctx, userID, Input{Category: "paper", URL: firstURL + "#other", Affirmed: true}); !errors.Is(err, ErrDuplicate) {
		t.Fatalf("variant duplicate: %v", err)
	}
	mine, err := s.Mine(ctx, userID, 1)
	if err != nil || mine.AllTime != base.AllTime+10 || mine.Last30Days != base.Last30Days+10 {
		t.Fatalf("award not counted: %+v, %v", mine, err)
	}
	foundry, err := s.Foundry(ctx, userID, time.Now())
	if err != nil || foundry.Points != baseFoundry.Points+10 || foundry.Name == "" {
		t.Fatalf("award not counted toward Foundry month: %+v, %v", foundry, err)
	}
	if previous, err := s.Foundry(ctx, userID, previousMonth); err != nil || previous.Points != basePrevious.Points {
		t.Fatalf("award counted toward previous Foundry month: %+v, %v", previous, err)
	}
	board, err := s.Leaderboard(ctx, userID, "30d")
	if err != nil {
		t.Fatal(err)
	}
	found := board.Own != nil
	for _, entry := range board.Entries {
		found = found || entry.IsYou
	}
	if !found {
		t.Fatal("active member omitted from leaderboard")
	}
	withdrawn, err := s.Withdraw(ctx, userID, created.ID)
	if err != nil || withdrawn.Status != "withdrawn" {
		t.Fatalf("withdraw failed: %v", err)
	}
	if again, err := s.Withdraw(ctx, userID, created.ID); err != nil || again.Status != "withdrawn" {
		t.Fatal("withdraw retry changed claim")
	}
	mine, err = s.Mine(ctx, userID, 1)
	if err != nil || mine.AllTime != base.AllTime {
		t.Fatal("withdraw did not deduct points")
	}
	if foundry, err := s.Foundry(ctx, userID, time.Now()); err != nil || foundry.Points != baseFoundry.Points {
		t.Fatal("withdraw did not deduct Foundry points")
	}
	revoked, err := s.Moderate(ctx, userID, created.ID, "revoke", "Invalid claim")
	if err != nil || revoked.Status != "revoked" || revoked.StatusReason == nil {
		t.Fatal("staff revocation failed")
	}
	restored, err := s.Moderate(ctx, userID, created.ID, "restore", "Reviewed")
	if err != nil || restored.Status != "awarded" || !restored.AwardedAt.Equal(created.AwardedAt) {
		t.Fatal("restore changed original award date")
	}
	// Simulate an earlier rate: fixing only the URL must keep the original
	// award amount even if the category's current value later changes.
	if _, err := pool.Exec(ctx, `update csc.point_claims set points_awarded = 17 where id = $1::uuid`, created.ID); err != nil {
		t.Fatal(err)
	}
	secondURL := firstURL + "-corrected"
	corrected, err := s.Correct(ctx, userID, created.ID, Correction{Category: "paper", URL: secondURL, Reason: "Fixed link"})
	if err != nil || corrected.URL != secondURL || corrected.Points != 17 {
		t.Fatalf("correction failed: %v", err)
	}
	if again, err := s.Correct(ctx, userID, created.ID, Correction{Category: "paper", URL: secondURL, Reason: "Fixed link"}); err != nil || !again.ChangedAt.Equal(corrected.ChangedAt) {
		t.Fatal("correction retry changed claim")
	}
	for _, link := range []string{firstURL, secondURL} {
		if _, err := s.Create(ctx, userID, Input{Category: "paper", URL: link, Affirmed: true}); !errors.Is(err, ErrDuplicate) {
			t.Fatalf("lifetime link reused: %v", err)
		}
	}
	var audits int
	if err := pool.QueryRow(ctx, `select count(*) from csc.point_claim_audit where claim_id = $1::uuid`, created.ID).Scan(&audits); err != nil || audits != 4 {
		t.Fatalf("audit count: %d, %v", audits, err)
	}
}
