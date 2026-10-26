package profile

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Opt-in against an isolated schema populated by the migrations. This test
// refuses hosted databases and never resets a database or uses real accounts.
func TestAlumniPostgresLifecycle(t *testing.T) {
	raw := os.Getenv("ALUMNI_TEST_DATABASE_URL")
	if raw == "" {
		t.Skip("ALUMNI_TEST_DATABASE_URL not set; requires isolated PostgreSQL with CRM migrations")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Path != "/pittcsc_alumni_test" || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Fatal("refusing a non-isolated AlumniDB test database")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	s := Store{DB: db}
	ids := []string{}
	defer func() {
		for _, id := range ids {
			if _, err := db.Exec(ctx, `delete from auth.users where id=$1::uuid`, id); err != nil {
				t.Error(err)
			}
		}
	}()
	fixture := func() (string, Input) {
		b := make([]byte, 16)
		_, _ = rand.Read(b)
		id := fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
		ids = append(ids, id)
		if _, err := db.Exec(ctx, `insert into auth.users(id) values($1::uuid)`, id); err != nil {
			t.Fatal(err)
		}
		r, err := s.GetOrCreate(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		if r.AlumniPublished {
			t.Fatal("new account published automatically")
		}
		input := Input{FirstName: ptr("Alumni"), LastName: ptr("Fixture"), GraduationYear: ptr(time.Now().Year()), LinkedInUsername: ptr("alumni-fixture"), AlumniFields: &AlumniFields{Location: ptr("Test City"), Bio: ptr("Synthetic alumni fixture"), CurrentCompany: ptr("Test Company"), CurrentRole: ptr("Engineer"), PositionIsCurrent: true, ContactEmail: ptr("alumni@example.org"), OpenToMentorship: true}}
		if _, err := s.Update(ctx, id, input); err != nil {
			t.Fatal(err)
		}
		if err := s.PutAsset(ctx, id, "avatar", "image/png", []byte("synthetic-image")); err != nil {
			t.Fatal(err)
		}
		return id, input
	}
	id, input := fixture()
	if _, err := s.SetAlumniPublication(ctx, id, true); err != nil {
		t.Fatal(err)
	}
	r, err := s.Get(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	stamp := r.AlumniUpdatedAt
	if len(r.AlumniMissing) != 0 || !r.AlumniPublished || r.Complete {
		t.Fatal("directory and CRM completion were conflated")
	}
	for range 2 {
		if _, err := s.SetAlumniPublication(ctx, id, true); err != nil {
			t.Fatal(err)
		}
	}
	page, err := s.ListAlumni(ctx, DirectoryQuery{Page: 1})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Data) != 1 {
		t.Fatal("publish duplicated or hid profile")
	}
	directoryID := page.Data[0].ID
	input.GitHubUsername = ptr("private-handle")
	r, err = s.Update(ctx, id, input)
	if err != nil {
		t.Fatal(err)
	}
	if !r.AlumniUpdatedAt.Equal(stamp) {
		t.Fatal("private edit changed directory timestamp")
	}
	r, err = s.SetAlumniPublication(ctx, id, false)
	if err != nil {
		t.Fatal(err)
	}
	if !r.AlumniUpdatedAt.Equal(stamp) {
		t.Fatal("publication toggle changed information timestamp")
	}
	if _, err := s.GetAlumnus(ctx, directoryID); err != ErrNotFound {
		t.Fatal("unpublished detail exposed")
	}
	if _, err := s.AlumniPhoto(ctx, directoryID); err != ErrNotFound {
		t.Fatal("unpublished photo exposed")
	}
	page, err = s.ListAlumni(ctx, DirectoryQuery{Page: 1})
	if err != nil || page.Count != 0 || len(page.Options.Locations) != 0 {
		t.Fatal("unpublished profile leaked through list/options", err)
	}
	if _, err := s.SetAlumniPublication(ctx, id, true); err != nil {
		t.Fatal(err)
	}
	input.Bio = nil
	r, err = s.Update(ctx, id, input)
	if err != nil || r.AlumniPublished {
		t.Fatal("invalidating edit did not atomically unpublish", err)
	}
	if _, err := s.SetAlumniPublication(ctx, id, true); err != ErrIneligible {
		t.Fatal("incomplete publication accepted", err)
	}
	input.Bio = ptr("Updated bio")
	r, err = s.Update(ctx, id, input)
	if err != nil || r.AlumniPublished {
		t.Fatal("repair republished automatically", err)
	}
	if _, err := s.SetAlumniPublication(ctx, id, true); err != nil {
		t.Fatal(err)
	}
	before := r.AlumniUpdatedAt
	if err := s.PutAsset(ctx, id, "avatar", "image/png", []byte("replacement-image")); err != nil {
		t.Fatal(err)
	}
	r, err = s.Get(ctx, id)
	if err != nil || !r.AlumniUpdatedAt.After(before) {
		t.Fatal("replacing photo did not update directory timestamp", err)
	}
	if err := s.DeleteAsset(ctx, id, "avatar"); err != nil {
		t.Fatal(err)
	}
	r, err = s.Get(ctx, id)
	if err != nil || r.AlumniPublished {
		t.Fatal("photo removal left profile published", err)
	}
	if err := s.PutAsset(ctx, id, "avatar", "image/png", []byte("replacement-image")); err != nil {
		t.Fatal(err)
	}
	// Race publication against clearing an eligibility field. Whichever write
	// wins the lock, no incomplete profile can remain published.
	input.ContactEmail = nil
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, e := s.SetAlumniPublication(ctx, id, true)
		if e != nil && e != ErrIneligible {
			t.Error(e)
		}
	}()
	go func() {
		defer wg.Done()
		_, e := s.Update(ctx, id, input)
		if e != nil {
			t.Error(e)
		}
	}()
	wg.Wait()
	r, err = s.Get(ctx, id)
	if err != nil || r.AlumniPublished {
		t.Fatal("concurrent save/publish broke invariant", err)
	}
	// Multiple pages, combined filters, literal wildcard search and hidden facets.
	for range 22 {
		fid, _ := fixture()
		if _, err := s.SetAlumniPublication(ctx, fid, true); err != nil {
			t.Fatal(err)
		}
	}
	page, err = s.ListAlumni(ctx, DirectoryQuery{Page: 1, Mentorship: true, Location: "Test City", Search: "engineer"})
	if err != nil || len(page.Data) != 20 || page.Count != 22 || !page.HasMore {
		t.Fatal("bad first page", err, page.Count, len(page.Data))
	}
	next, err := s.ListAlumni(ctx, DirectoryQuery{Page: 2, Mentorship: true, Location: "Test City", Search: "engineer"})
	if err != nil || len(next.Data) != 2 || next.HasMore {
		t.Fatal("bad next page", err)
	}
	seen := map[string]bool{}
	for _, d := range append(page.Data, next.Data...) {
		if seen[d.ID] {
			t.Fatal("duplicate across pages")
		}
		seen[d.ID] = true
	}
	literal, err := s.ListAlumni(ctx, DirectoryQuery{Page: 1, Search: "%"})
	if err != nil || literal.Count != 0 {
		t.Fatal("search unexpectedly treated percent as wildcard", err)
	}
	if _, err := db.Exec(ctx, `update csc.profiles set account_status='suspended' where auth_user_id=$1::uuid`, ids[1]); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetAlumniPublication(ctx, ids[1], true); err != ErrSuspended {
		t.Fatal("suspended owner could publish", err)
	}
	page, err = s.ListAlumni(ctx, DirectoryQuery{Page: 1})
	if err != nil || page.Count != 21 {
		t.Fatal("suspended profile was visible", err)
	}
}
