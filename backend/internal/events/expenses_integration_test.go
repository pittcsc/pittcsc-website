package events

import (
	"context"
	"errors"
	"net/url"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestExpensesIntegration(t *testing.T) {
	dsn := os.Getenv("EVENTS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("run mise run test:events for local Postgres integration")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost" && u.Hostname() != "::1") {
		t.Fatal("nonlocal database refused")
	}
	actor, other, member := os.Getenv("EVENTS_TEST_ACTOR_ID"), os.Getenv("EVENTS_TEST_ACTOR_B_ID"), os.Getenv("EVENTS_TEST_MEMBER_ID")
	for _, id := range []string{actor, other, member} {
		if !uuidPattern.MatchString(id) {
			t.Fatal("synthetic actor fixtures required")
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal("local database unavailable")
	}
	defer pool.Close()
	s := Store{DB: pool}
	e, err := s.Save(ctx, actor, fixtureID(), validInput())
	if err != nil {
		t.Fatal(err)
	}
	image := []byte("receipt image bytes")

	x, err := s.Expenses(ctx, e.ID)
	if err != nil || x.TotalCents != 0 || len(x.Receipts) != 0 {
		t.Fatal("new event must have no recorded spending")
	}
	if err := s.PutReceipt(ctx, member, e.ID, fixtureID(), 100, "image/png", image); !errors.Is(err, ErrForbidden) {
		t.Fatal("non-staff receipt accepted")
	}
	if err := s.PutReceipt(ctx, actor, fixtureID(), fixtureID(), 100, "image/png", image); !errors.Is(err, ErrNotFound) {
		t.Fatal("receipt saved for unknown event")
	}
	if err := s.PutReceipt(ctx, actor, e.ID, fixtureID(), MaxAmountCents+1, "image/png", image); !errors.Is(err, ErrInvalid) {
		t.Fatal("amount bound ignored")
	}

	// Receipt retries reuse their ID and amount; a changed amount conflicts.
	first := fixtureID()
	for range 3 {
		if err := s.PutReceipt(ctx, actor, e.ID, first, 1250, "image/png", image); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.PutReceipt(ctx, actor, e.ID, first, 9999, "image/png", image); !errors.Is(err, ErrConflict) {
		t.Fatal("receipt amount silently changed by ID reuse")
	}

	// Concurrent uploads respect the limit, and the total sums accepted receipts.
	var wg sync.WaitGroup
	var accepted, limited atomic.Int32
	for range MaxReceipts + 4 {
		wg.Go(func() {
			err := s.PutReceipt(ctx, other, e.ID, fixtureID(), 100, "image/jpeg", image)
			switch {
			case err == nil:
				accepted.Add(1)
			case errors.Is(err, ErrReceiptLimit):
				limited.Add(1)
			default:
				t.Errorf("concurrent receipt: %v", err)
			}
		})
	}
	wg.Wait()
	x, err = s.Expenses(ctx, e.ID)
	if err != nil || len(x.Receipts) != MaxReceipts || accepted.Load() != MaxReceipts-1 || limited.Load() != 5 {
		t.Fatalf("receipt count %d, accepted %d, limited %d", len(x.Receipts), accepted.Load(), limited.Load())
	}
	if x.TotalCents != 1250+int64(MaxReceipts-1)*100 {
		t.Fatalf("total %d is not the sum of receipts", x.TotalCents)
	}
	if x.Receipts[0].ID != first || x.Receipts[0].AmountCents != 1250 || x.Receipts[0].Size != len(image) || x.Receipts[0].UploadedByName == "" {
		t.Fatal("receipt metadata missing")
	}
	r, err := s.Receipt(ctx, e.ID, first)
	if err != nil || r.MediaType != "image/png" || string(r.Bytes) != string(image) {
		t.Fatal("receipt bytes not stored")
	}

	// Amount edits compare against the amount the editor saw.
	if err := s.UpdateReceiptAmount(ctx, member, e.ID, first, 1250, 2000); !errors.Is(err, ErrForbidden) {
		t.Fatal("non-staff amount edit accepted")
	}
	for range 2 {
		if err := s.UpdateReceiptAmount(ctx, actor, e.ID, first, 1250, 2000); err != nil {
			t.Fatal("retried amount edit must succeed")
		}
	}
	if err := s.UpdateReceiptAmount(ctx, other, e.ID, first, 1250, 1); !errors.Is(err, ErrReceiptChanged) {
		t.Fatal("stale amount edit overwrote a newer one")
	}
	if err := s.UpdateReceiptAmount(ctx, actor, e.ID, fixtureID(), 0, 1); !errors.Is(err, ErrNotFound) {
		t.Fatal("unknown receipt edited")
	}
	if x, err = s.Expenses(ctx, e.ID); err != nil || x.TotalCents != 2000+int64(MaxReceipts-1)*100 || x.Receipts[0].AmountCents != 2000 {
		t.Fatal("total not recomputed after edit")
	}

	// The budget package carries every receipt and the full roster in check-in order.
	if _, err := s.CheckIn(ctx, member, e.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CheckIn(ctx, actor, e.ID); err != nil {
		t.Fatal(err)
	}
	pkg, err := s.BudgetPackage(ctx, e.ID)
	if err != nil || pkg.Event.ID != e.ID || len(pkg.Receipts) != MaxReceipts || len(pkg.Attendees) != 2 {
		t.Fatal("budget package incomplete")
	}
	var memberEmail string
	if err := pool.QueryRow(ctx, `select email from auth.users where id = $1::uuid`, member).Scan(&memberEmail); err != nil {
		t.Fatal(err)
	}
	if pkg.Attendees[0].Email != memberEmail || pkg.Receipts[0].AmountCents != 2000 || len(pkg.Receipts[0].Bytes) == 0 {
		t.Fatal("budget package out of order or missing data")
	}
	if _, err := s.BudgetPackage(ctx, fixtureID()); !errors.Is(err, ErrNotFound) {
		t.Fatal("budget package for unknown event")
	}

	// Receipts are scoped to their event.
	e2, err := s.Save(ctx, actor, fixtureID(), validInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Receipt(ctx, e2.ID, first); !errors.Is(err, ErrNotFound) {
		t.Fatal("receipt readable through another event")
	}
	if err := s.PutReceipt(ctx, actor, e2.ID, first, 1250, "image/png", image); !errors.Is(err, ErrConflict) {
		t.Fatal("receipt ID reused across events")
	}
	if err := s.DeleteReceipt(ctx, actor, e2.ID, first); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Receipt(ctx, e.ID, first); err != nil {
		t.Fatal("delete through another event removed a receipt")
	}
	if err := s.DeleteReceipt(ctx, member, e.ID, first); !errors.Is(err, ErrForbidden) {
		t.Fatal("non-staff delete accepted")
	}
	for range 2 {
		if err := s.DeleteReceipt(ctx, actor, e.ID, first); err != nil {
			t.Fatal("receipt removal must be idempotent")
		}
	}
	if _, err := s.Receipt(ctx, e.ID, first); !errors.Is(err, ErrNotFound) {
		t.Fatal("receipt not removed")
	}
	if x, err = s.Expenses(ctx, e.ID); err != nil || x.TotalCents != int64(MaxReceipts-1)*100 {
		t.Fatal("removed receipt still counted in total")
	}

	// Spending stays editable after cancellation.
	if _, err := s.Cancel(ctx, actor, e.ID, e.Version); err != nil {
		t.Fatal(err)
	}
	if err := s.PutReceipt(ctx, actor, e.ID, fixtureID(), 0, "image/png", image); err != nil {
		t.Fatal("cancelled event receipt rejected")
	}
}
