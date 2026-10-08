package events

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type memoryCalendar struct {
	mu           sync.Mutex
	events       map[string]Event
	deleted      map[string]bool
	fail         bool
	loseResponse bool
	inserts      int
	entered      chan struct{}
	release      chan struct{}
}

func (m *memoryCalendar) Upsert(ctx context.Context, e Event) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.entered != nil {
		close(m.entered)
		m.entered = nil
		select {
		case <-m.release:
		case <-ctx.Done():
			return "", ctx.Err()
		}
	}
	if m.fail {
		return "", ErrCalendar
	}
	if m.deleted[e.CalendarEventID] {
		return "", ErrGone
	}
	if _, ok := m.events[e.CalendarEventID]; !ok {
		m.inserts++
	}
	m.events[e.CalendarEventID] = e
	if m.loseResponse {
		m.loseResponse = false
		return "", ErrCalendar
	}
	return "https://calendar.google.com/calendar/event?eid=local-fixture", nil
}
func (m *memoryCalendar) Remove(_ context.Context, e Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.fail {
		return ErrCalendar
	}
	delete(m.events, e.CalendarEventID)
	m.deleted[e.CalendarEventID] = true
	return nil
}
func fixtureID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	raw := hex.EncodeToString(b[:])
	return raw[:8] + "-" + raw[8:12] + "-" + raw[12:16] + "-" + raw[16:20] + "-" + raw[20:]
}

func TestStoreIntegration(t *testing.T) {
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
	m := &memoryCalendar{events: map[string]Event{}, deleted: map[string]bool{}}
	s := Store{DB: pool, Calendar: m, CalendarID: "local-event-test"}
	id := fixtureID()
	in := validInput()
	if _, err := s.Save(ctx, member, fixtureID(), in); !errors.Is(err, ErrForbidden) {
		t.Fatal("non-staff storage mutation accepted")
	}

	// Concurrent creation retries commit one event and one creation audit entry.
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			if e, err := s.Save(ctx, actor, id, in); err != nil || e.SyncStatus != "synced" {
				t.Errorf("concurrent create failed: %v (status %s)", err, e.SyncStatus)
			}
		})
	}
	wg.Wait()
	var count int
	if err := pool.QueryRow(ctx, `select count(*) from csc.event_audit where event_id=$1::uuid and action='created'`, id).Scan(&count); err != nil || count != 1 || m.inserts != 1 {
		t.Fatal("duplicate creation or audit")
	}
	e, err := s.Get(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	in.Version, in.Title = e.Version, "Edited by other staff"
	e, err = s.Save(ctx, other, id, in)
	if err != nil || e.Version != 2 || m.events[e.CalendarEventID].Title != in.Title {
		t.Fatal("other staff edit not delivered")
	}
	stale := in
	stale.Title = "Stale overwrite"
	if _, err := s.Save(ctx, actor, id, stale); !errors.Is(err, ErrConflict) {
		t.Fatal("stale edit silently overwritten")
	}

	// An outage preserves the edit and audit, then explicit sync sends latest data.
	m.fail = true
	in.Version, in.Title = e.Version, "Saved through outage"
	e, err = s.Save(ctx, actor, id, in)
	if err != nil || e.SyncStatus != "failed" || e.Title != in.Title {
		t.Fatal("outage lost saved event")
	}
	m.fail = false
	e, err = s.Sync(ctx, actor, id)
	if err != nil || e.SyncStatus != "synced" || m.events[e.CalendarEventID].Title != in.Title {
		t.Fatal("manual retry failed")
	}

	// Deleted Google IDs are tombstones; replacement identity must be durable.
	oldID := e.CalendarEventID
	delete(m.events, oldID)
	m.deleted[oldID] = true
	m.loseResponse = true
	e, err = s.Sync(ctx, actor, id)
	if err != nil || e.SyncStatus != "failed" || e.CalendarEventID == oldID {
		t.Fatal("replacement ID not saved before uncertain insert")
	}
	newID := e.CalendarEventID
	e, err = s.Sync(ctx, actor, id)
	if err != nil || e.CalendarEventID != newID || e.SyncStatus != "synced" || len(m.events) != 1 {
		t.Fatal("replacement retry duplicated event")
	}

	// Cancellation stays saved during a removal failure; subsequent retries are safe.
	m.fail = true
	e, err = s.Cancel(ctx, other, id, e.Version)
	if err != nil || e.Status != "cancelled" || e.SyncStatus != "failed" {
		t.Fatal("cancellation lost on outage")
	}
	m.fail = false
	e, err = s.Sync(ctx, actor, id)
	if err != nil || e.SyncStatus != "synced" || len(m.events) != 0 {
		t.Fatal("removal retry failed")
	}
	if _, err := s.Cancel(ctx, actor, id, 1); err != nil {
		t.Fatal("duplicate cancellation failed")
	}
	if _, err := s.Save(ctx, actor, id, in); !errors.Is(err, ErrCancelled) {
		t.Fatal("cancelled event edited")
	}
	h, err := s.History(ctx, id, 0)
	if err != nil || len(h.Entries) < 6 {
		t.Fatal("audit history missing")
	}
	if err := pool.QueryRow(ctx, `select count(*) from csc.event_audit where event_id=$1::uuid and action='cancelled'`, id).Scan(&count); err != nil || count != 1 {
		t.Fatal("duplicate cancellation audit")
	}

	// A slow sync and a simultaneous cancellation serialize without resurrection.
	id2 := fixtureID()
	e2, err := s.Save(ctx, actor, id2, validInput())
	if err != nil {
		t.Fatal(err)
	}
	entered, release := make(chan struct{}), make(chan struct{})
	m.entered, m.release = entered, release
	synced := make(chan error, 1)
	go func() { _, err := s.Sync(ctx, actor, id2); synced <- err }()
	select {
	case <-entered:
	case <-ctx.Done():
		t.Fatal("sync did not start")
	}
	cancelled := make(chan error, 1)
	go func() { _, err := s.Cancel(ctx, other, id2, e2.Version); cancelled <- err }()
	close(release)
	if err := <-synced; err != nil {
		t.Fatal(err)
	}
	if err := <-cancelled; err != nil {
		t.Fatal(err)
	}
	e2, _ = s.Get(ctx, id2)
	if e2.Status != "cancelled" || len(m.events) != 0 {
		t.Fatal("concurrent sync resurrected cancelled event")
	}

	// A disabled connector still saves records and surfaces setup status.
	disabled := Store{DB: pool}
	e3, err := disabled.Save(ctx, actor, fixtureID(), validInput())
	if err != nil || e3.SyncStatus != "disabled" {
		t.Fatal("disabled mode prevents saving")
	}
	state, err := disabled.CheckInStatus(ctx, member, e3.ID)
	if err != nil || state.CheckedInAt != nil || state.Title != e3.Title {
		t.Fatal("attendance GET must only read the current user's state")
	}
	for range 8 {
		wg.Go(func() {
			if _, err := disabled.CheckIn(ctx, member, e3.ID); err != nil {
				t.Errorf("concurrent check-in: %v", err)
			}
		})
	}
	wg.Wait()
	roster, err := disabled.Attendance(ctx, e3.ID, 1)
	if err != nil || roster.Count != 1 || len(roster.Attendees) != 1 || roster.Attendees[0].Email == "" {
		t.Fatal("duplicate check-in or private roster lookup failed")
	}
	state, err = disabled.CheckInStatus(ctx, member, e3.ID)
	if err != nil || state.CheckedInAt == nil {
		t.Fatal("check-in state was not persisted")
	}
	if _, err := disabled.CheckIn(ctx, fixtureID(), e3.ID); !errors.Is(err, profile.ErrSuspended) {
		t.Fatal("unknown account checked in")
	}
	if _, err := pool.Exec(ctx, `update csc.profiles set account_status='suspended' where auth_user_id=$1::uuid`, member); err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(context.Background(), `update csc.profiles set account_status='active' where auth_user_id=$1::uuid`, member)
	if _, err := disabled.CheckIn(ctx, member, e3.ID); !errors.Is(err, profile.ErrSuspended) {
		t.Fatal("suspended account checked in")
	}
	if _, err := pool.Exec(ctx, `update csc.profiles set account_status='active' where auth_user_id=$1::uuid`, member); err != nil {
		t.Fatal(err)
	}
	e3, err = disabled.Cancel(ctx, actor, e3.ID, e3.Version)
	if err != nil || !strings.Contains(e3.SyncError, "publicly visible") {
		t.Fatal("disabled cancellation must warn that Google removal is unconfirmed")
	}
	if _, err := disabled.CheckIn(ctx, other, e3.ID); !errors.Is(err, ErrCancelled) {
		t.Fatal("cancelled event accepted check-in")
	}
	roster, err = disabled.Attendance(ctx, e3.ID, 1)
	if err != nil || roster.Count != 1 {
		t.Fatal("cancellation lost existing attendance")
	}
}
