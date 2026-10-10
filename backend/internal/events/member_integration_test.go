package events

import (
	"context"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMemberUpcomingIntegration(t *testing.T) {
	dsn := os.Getenv("EVENTS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("run mise run test:events for local Postgres integration")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost" && u.Hostname() != "::1") {
		t.Fatal("nonlocal database refused")
	}
	actor := os.Getenv("EVENTS_TEST_ACTOR_ID")
	if !uuidPattern.MatchString(actor) {
		t.Fatal("synthetic actor fixture required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	t.Cleanup(func() {
		defer pool.Close()
		cleanupCtx, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		for _, id := range ids {
			if _, err := pool.Exec(cleanupCtx, `delete from csc.events where id=$1::uuid`, id); err != nil {
				t.Errorf("remove synthetic member event: %v", err)
			}
		}
	})
	insert := func(title, status, syncStatus string, start, end time.Time) string {
		t.Helper()
		id := fixtureID()
		_, err := pool.Exec(ctx, `insert into csc.events
			(id, title, location, description, starts_at, ends_at, status, created_by,
			 calendar_id, calendar_event_id, sync_status)
			values ($1::uuid, $2, 'Test room', 'Synthetic fixture', $3, $4, $5,
			 $6::uuid, 'member-list-test', $7, $8)`, id, title, start, end, status, actor,
			strings.ReplaceAll(id, "-", ""), syncStatus)
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
		return id
	}
	end := time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC)
	first := insert("Ongoing first", "active", "synced", time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC), end)
	insert("Ongoing failed sync", "active", "failed", time.Date(2001, 1, 1, 0, 0, 0, 0, time.UTC), end)
	insert("Ongoing third", "active", "pending", time.Date(2002, 1, 1, 0, 0, 0, 0, time.UTC), end)
	insert("Ongoing fourth", "active", "disabled", time.Date(2003, 1, 1, 0, 0, 0, 0, time.UTC), end)
	insert("Cancelled", "cancelled", "failed", time.Date(1999, 1, 1, 0, 0, 0, 0, time.UTC), end)
	insert("Past", "active", "synced", time.Date(1998, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(1999, 1, 1, 0, 0, 0, 0, time.UTC))
	s := Store{DB: pool}
	result, err := s.ListUpcoming(ctx)
	if err != nil || len(result.Events) != 3 || result.Events[0].Title != "Ongoing first" ||
		result.Events[1].Title != "Ongoing failed sync" || result.Events[2].Title != "Ongoing third" {
		t.Fatalf("member event ordering/filtering failed: %+v (%v)", result, err)
	}
	if _, err := pool.Exec(ctx, `update csc.events set status='cancelled' where id=$1::uuid`, first); err != nil {
		t.Fatal(err)
	}
	result, err = s.ListUpcoming(ctx)
	if err != nil || len(result.Events) != 3 || result.Events[0].Title != "Ongoing failed sync" ||
		result.Events[2].Title != "Ongoing fourth" {
		t.Fatalf("cancellation was not reflected in member list: %+v (%v)", result, err)
	}
}
