package campaigns

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"image"
	"image/png"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	v := hex.EncodeToString(b[:])
	return v[:8] + "-" + v[8:12] + "-" + v[12:16] + "-" + v[16:20] + "-" + v[20:]
}

type memoryTransport struct {
	mu       sync.Mutex
	Messages []Message
	Err      error
}

func (m *memoryTransport) Send(_ context.Context, v Message) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Messages = append(m.Messages, v)
	return "synthetic-" + v.AttemptID, m.Err
}
func TestCampaignStoreIntegration(t *testing.T) {
	dsn := os.Getenv("CAMPAIGNS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("run mise run test:email for isolated local database integration")
	}
	u, e := url.Parse(dsn)
	if e != nil || u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost" && u.Hostname() != "::1" {
		t.Fatal("nonlocal database refused")
	}
	actor, other := os.Getenv("CAMPAIGNS_TEST_ACTOR_ID"), os.Getenv("CAMPAIGNS_TEST_MEMBER_ID")
	if !ValidID(actor) || !ValidID(other) {
		t.Fatal("synthetic fixture identities required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	pool, e := pgxpool.New(ctx, dsn)
	if e != nil {
		t.Fatal("local database unavailable")
	}
	defer pool.Close()
	transport := &memoryTransport{}
	s := &Store{DB: pool, Transport: transport, PublicURL: "http://localhost:8080"}
	s.dispatchScope = []string{}
	saveDraft := func(ctx context.Context, actor, id string, input DraftInput) (Draft, error) {
		if !slices.Contains(s.dispatchScope, id) {
			s.dispatchScope = append(s.dispatchScope, id)
		}
		return s.SaveDraft(ctx, actor, id, input)
	}
	nonce := testID()
	tag := "fixture-" + nonce
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatalf("campaign integration: %v", e)
		}
	}
	_, e = s.SetSubscription(ctx, other, true)
	must(e)
	t.Run("account_enrollment_and_authority", func(t *testing.T) {
		c, e := s.Subscription(ctx, other)
		must(e)
		if !c.Subscribed || c.UserID == nil {
			t.Fatal("existing/new CRM account not enrolled")
		}
		input := ContactInput{FirstName: "Imposter", LastName: "Other", Email: c.Email, Tags: []string{tag}, Version: c.Version}
		saved, e := s.SaveContact(ctx, actor, c.ID, input)
		must(e)
		if saved.FirstName != c.FirstName || len(saved.Tags) != 1 {
			t.Fatal("linked profile authority not preserved")
		}
		if _, e = s.SaveContact(ctx, other, "new", ContactInput{FirstName: "No", LastName: "Access", Email: "denied-" + nonce + "@example.test"}); !errors.Is(e, ErrBlocked) {
			t.Fatal("member wrote contacts")
		}
		_, e = s.SetSubscription(ctx, other, false)
		must(e)
		_, e = pool.Exec(ctx, `update csc.profiles set first_name=first_name where auth_user_id=$1::uuid`, other)
		must(e)
		c, e = s.Subscription(ctx, other)
		must(e)
		if c.Subscribed {
			t.Fatal("profile synchronization restored unsubscribe")
		}
	})
	var contact Contact
	t.Run("imports_conflicts_and_preserved_optouts", func(t *testing.T) {
		email := "import-" + nonce + "@example.test"
		in := ImportInput{CSV: "first,last,email,tags,year\nFirst,Last," + email + "," + tag + ",\nDuplicate,Row," + email + ",,\nMissing,,bad,,\n", Mapping: map[string]int{"firstName": 0, "lastName": 1, "email": 2, "tags": 3, "graduationYear": 4}}
		v, e := s.PreviewImport(ctx, actor, in)
		must(e)
		if len(v.Rows) != 3 || v.Rows[1].Error == "" || v.Rows[2].Error == "" {
			t.Fatal("preview validation missing")
		}
		result, e := s.CommitImport(ctx, actor, v.ID, false, nil)
		must(e)
		if result.Count != 1 {
			t.Fatal("invalid or duplicate row imported")
		}
		again, e := s.CommitImport(ctx, actor, v.ID, false, nil)
		must(e)
		if again.Count != 1 {
			t.Fatal("import retry was not idempotent")
		}
		cs, e := s.Contacts(ctx)
		must(e)
		for _, c := range cs {
			if c.Email == email {
				contact = c
			}
		}
		if contact.ID == "" || contact.Year != nil {
			t.Fatal("contact missing or optional field required")
		}
		must(s.Unsubscribe(ctx, contact.Token))
		v, e = s.PreviewImport(ctx, actor, in)
		must(e)
		_, e = s.CommitImport(ctx, actor, v.ID, false, nil)
		must(e)
		contact, e = scanContact(pool.QueryRow(ctx, contactSelect+` where c.id=$1::uuid`, contact.ID))
		must(e)
		if contact.Subscribed {
			t.Fatal("reimport restored unsubscribe")
		}
		v, e = s.PreviewImport(ctx, actor, in)
		must(e)
		_, e = pool.Exec(ctx, `update csc.email_contacts set version=version+1 where id=$1::uuid`, contact.ID)
		must(e)
		if _, e = s.CommitImport(ctx, actor, v.ID, false, nil); !errors.Is(e, ErrConflict) {
			t.Fatal("stale preview overwrote concurrent changes")
		}
		_, e = pool.Exec(ctx, `update csc.email_contacts set subscribed=true where id=$1::uuid`, contact.ID)
		must(e)
	})
	var draft Draft
	t.Run("shared_drafts_and_concurrent_autosave", func(t *testing.T) {
		in := DraftInput{Name: "Synthetic newsletter", Subject: "Hello", Blocks: []Block{{Type: "text", Text: "Hello {{firstName}}"}}, Audience: Audience{Mode: "all", Conditions: []Condition{{Field: "tag", Value: tag}}, Exclusions: []Condition{{Field: "role", Value: "member"}}}}
		id := testID()
		d, e := saveDraft(ctx, actor, id, in)
		must(e)
		again, e := saveDraft(ctx, actor, id, in)
		must(e)
		if again.ID != d.ID || again.Version != d.Version {
			t.Fatal("creation retry duplicated draft")
		}
		in.Version = d.Version
		in.Subject = "Updated"
		var wg sync.WaitGroup
		errs := make(chan error, 2)
		for range 2 {
			wg.Go(func() { _, e := saveDraft(ctx, actor, id, in); errs <- e })
		}
		wg.Wait()
		close(errs)
		success, conflicts := 0, 0
		for e := range errs {
			if e == nil {
				success++
			} else if errors.Is(e, ErrConflict) {
				conflicts++
			} else {
				must(e)
			}
		}
		if success != 1 || conflicts != 1 {
			t.Fatal("concurrent edits silently overwrote")
		}
		draft, e = s.Draft(ctx, id)
		must(e)
	})
	t.Run("dispatch_freeze_uncertain_review_and_events", func(t *testing.T) {
		transport.Err = errors.New("response lost")
		d, e := s.Action(ctx, actor, draft.ID, "send", draft.Version, "")
		must(e)
		must(s.Run(ctx, 10, 0))
		r, e := s.Report(ctx, d.ID)
		must(e)
		if len(transport.Messages) != 1 || len(r.Recipients) != 1 || r.Recipients[0].Status != "uncertain" {
			t.Fatal("unexpected recipients or uncertain send lost")
		}
		must(s.Run(ctx, 10, 0))
		if len(transport.Messages) != 1 {
			t.Fatal("uncertain send automatically retried")
		}
		m := transport.Messages[0]
		event := map[string]any{"eventType": "Delivery", "mail": map[string]any{"messageId": "provider-message", "tags": map[string][]string{"campaign": {m.CampaignID}, "attempt": {m.AttemptID}}}, "delivery": map[string]any{"timestamp": time.Now()}}
		b, _ := json.Marshal(event)
		sns := SNSMessage{MessageID: "event-" + testID(), Message: string(b)}
		must(s.Ingest(ctx, sns))
		must(s.Ingest(ctx, sns))
		must(s.Run(ctx, 10, 0))
		r, e = s.Report(ctx, d.ID)
		must(e)
		if r.Counts["delivered"] != 1 || r.Recipients[0].Status != "accepted" {
			t.Fatal("late or duplicate event reconciliation failed")
		}
		event["eventType"] = "Click"
		event["click"] = map[string]any{"link": "https://example.test/news", "timestamp": time.Now(), "isBotEvent": "Likely"}
		b, _ = json.Marshal(event)
		must(s.Ingest(ctx, SNSMessage{MessageID: "click-" + testID(), Message: string(b)}))
		r, e = s.Report(ctx, d.ID)
		must(e)
		if len(r.Clicks) != 1 || r.Clicks[0].Automated != 1 {
			t.Fatal("click aggregates missing")
		}
		event["eventType"] = "Complaint"
		event["complaint"] = map[string]any{"timestamp": time.Now()}
		b, _ = json.Marshal(event)
		must(s.Ingest(ctx, SNSMessage{MessageID: "complaint-" + testID(), Message: string(b)}))
		c, e := s.ByToken(ctx, contact.Token)
		must(e)
		if c.Blocked != "complaint" {
			t.Fatal("complaint did not block recipient")
		}
		d, e = s.Draft(ctx, d.ID)
		must(e)
		if e = s.Tests(ctx, actor, d.ID, testID(), d.Version, []string{contact.Email}); !errors.Is(e, ErrBlocked) {
			t.Fatal("test bypassed complaint block")
		}
	})
	t.Run("live_optout_cancellation_and_multiple_workers", func(t *testing.T) {
		transport.Err = nil
		first := len(transport.Messages)
		newDraft := func(tag string) Draft {
			d, e := saveDraft(ctx, actor, testID(), DraftInput{Name: "Worker fixture", Subject: "News", Blocks: []Block{{Type: "text", Text: "Fixture"}}, Audience: Audience{Mode: "all", Conditions: []Condition{{Field: "tag", Value: tag}}}})
			must(e)
			return d
		}
		for range 5 {
			_, e := s.SaveContact(ctx, actor, "new", ContactInput{FirstName: "First", LastName: "Last", Email: testID() + "@example.test", Tags: []string{tag + "-workers"}})
			must(e)
		}
		d := newDraft(tag + "-workers")
		d, e := s.Action(ctx, actor, d.ID, "send", d.Version, "")
		must(e)
		must(s.freeze(ctx))
		var recipientContact string
		e = pool.QueryRow(ctx, `select c.token from csc.email_contacts c join csc.email_recipients r on r.contact_id=c.id where r.campaign_id=$1::uuid limit 1`, d.ID).Scan(&recipientContact)
		must(e)
		must(s.Unsubscribe(ctx, recipientContact))
		var wg sync.WaitGroup
		errs := make(chan error, 2)
		for range 2 {
			wg.Go(func() { errs <- s.Run(ctx, 10, 0) })
		}
		wg.Wait()
		close(errs)
		for e := range errs {
			must(e)
		}
		if len(transport.Messages)-first != 4 {
			t.Fatal("concurrent workers duplicated delivery or ignored opt-out")
		}
		d = newDraft(tag + "-workers")
		d, e = s.Action(ctx, actor, d.ID, "send", d.Version, "")
		must(e)
		_, e = s.Action(ctx, actor, d.ID, "cancel", d.Version, "")
		must(e)
		first = len(transport.Messages)
		must(s.Run(ctx, 10, 0))
		if len(transport.Messages) != first {
			t.Fatal("cancelled campaign sent")
		}
	})
	t.Run("stable_images_and_test_snapshots", func(t *testing.T) {
		var b bytes.Buffer
		must(png.Encode(&b, image.NewRGBA(image.Rect(0, 0, 2, 2))))
		a, e := s.Upload(ctx, actor, "fixture.png", b.Bytes())
		must(e)
		media, data, e := s.Asset(ctx, a.ID)
		must(e)
		if media != "image/png" || len(data) == 0 {
			t.Fatal("uploaded asset unavailable")
		}
		d, e := saveDraft(ctx, actor, testID(), DraftInput{Name: "Test fixture", Subject: "Original", Blocks: []Block{{Type: "text", Text: "Original content"}}, Audience: Audience{Mode: "all"}})
		must(e)
		testEmail := "test-" + nonce + "@example.test"
		must(s.Tests(ctx, actor, d.ID, testID(), d.Version, []string{testEmail}))
		_, e = saveDraft(ctx, actor, d.ID, DraftInput{Name: d.Name, Subject: "Changed", Blocks: []Block{{Type: "text", Text: "Changed content"}}, Audience: d.Audience, Version: d.Version})
		must(e)
		must(s.Run(ctx, 10, 0))
		last := transport.Messages[len(transport.Messages)-1]
		if last.Subject != "[TEST] Original" || !strings.Contains(last.Text, "Original content") {
			t.Fatal("test snapshot changed after queueing")
		}
		r, e := s.Report(ctx, d.ID)
		must(e)
		if len(r.Recipients) != 0 {
			t.Fatal("test included in report")
		}
	})
	t.Run("scheduled_edits_review_and_resubscription", func(t *testing.T) {
		transport.Err = nil
		c, e := s.SaveContact(ctx, actor, "new", ContactInput{FirstName: "Review", LastName: "Fixture", Email: "review-" + nonce + "@example.test", Tags: []string{tag + "-review"}})
		must(e)
		d, e := saveDraft(ctx, actor, testID(), DraftInput{Name: "Review fixture", Subject: "Hi {{firstName}}", Blocks: []Block{{Type: "text", Text: "Hello"}}, Audience: Audience{Mode: "all", Conditions: []Condition{{Field: "tag", Value: tag + "-review"}}}})
		must(e)
		loc, _ := time.LoadLocation("America/New_York")
		at := time.Now().Add(24 * time.Hour).In(loc).Format("2006-01-02T15:04")
		d, e = s.Action(ctx, actor, d.ID, "schedule", d.Version, at)
		must(e)
		before := len(transport.Messages)
		must(s.Run(ctx, 10, 0))
		if len(transport.Messages) != before {
			t.Fatal("future campaign dispatched early")
		}
		d, e = s.Action(ctx, actor, d.ID, "draft", d.Version, "")
		must(e)
		d, e = s.Action(ctx, actor, d.ID, "send", d.Version, "")
		must(e)
		transport.Err = errors.New("response lost")
		must(s.Run(ctx, 10, 0))
		r, e := s.Report(ctx, d.ID)
		must(e)
		if r.Recipients[0].Status != "uncertain" {
			t.Fatal("uncertain state missing")
		}
		must(s.Resolve(ctx, actor, d.ID, r.Recipients[0].ID, "retry"))
		transport.Err = nil
		must(s.Run(ctx, 10, 0))
		r, e = s.Report(ctx, d.ID)
		must(e)
		if r.Recipients[0].Status != "accepted" || transport.Messages[len(transport.Messages)-1].Subject != "Hi Review" {
			t.Fatal("reviewed resend or subject personalization failed")
		}
		must(s.Unsubscribe(ctx, c.Token, d.ID))
		must(s.RequestResubscribe(ctx, c.Token))
		c, e = s.ByToken(ctx, c.Token)
		must(e)
		if c.Subscribed {
			t.Fatal("verification request subscribed without confirmation")
		}
		last := transport.Messages[len(transport.Messages)-1]
		parts := strings.Split(last.Text, "/email/verify/")
		if len(parts) != 2 {
			t.Fatal("verification mail missing")
		}
		code := strings.Split(parts[1], "\n")[0]
		must(s.ConfirmResubscribe(ctx, code))
		c, e = s.ByToken(ctx, c.Token)
		must(e)
		if !c.Subscribed {
			t.Fatal("verified resubscription missing")
		}
		if e = s.ConfirmResubscribe(ctx, code); !errors.Is(e, ErrNotFound) {
			t.Fatal("verification token reused")
		}
	})

}
