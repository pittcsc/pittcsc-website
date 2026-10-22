package server

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

const fixtureMemberID = "11111111-1111-4111-8111-111111111111"

type directoryStub struct {
	profilesStub
	query    string
	page     int
	targetID string
	staff    bool
	reads    int
}

func (s *directoryStub) Directory(_ context.Context, query string, page int) (profile.DirectoryPage, error) {
	s.query, s.page = query, page
	s.reads++
	return profile.DirectoryPage{Members: []profile.DirectoryMember{}, Page: page}, nil
}
func (s *directoryStub) PublicMember(_ context.Context, targetID string, staff bool) (profile.PublicMember, error) {
	s.targetID, s.staff = targetID, staff
	s.reads++
	return profile.PublicMember{DirectoryMember: profile.DirectoryMember{ID: targetID, Name: "Fixture Member"}}, nil
}
func (s *directoryStub) MemberAvatar(_ context.Context, targetID string, staff bool) (profile.Asset, error) {
	s.targetID, s.staff = targetID, staff
	s.reads++
	return profile.Asset{MediaType: "image/png", Bytes: []byte("image")}, nil
}

func directoryRequest(store *directoryStub, path, token string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("GET", path, nil)
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), store, nil, nil).ServeHTTP(w, r)
	return w
}

func TestDirectoryRequiresCompletedVerifiedAccount(t *testing.T) {
	for _, path := range []string{"/members", "/members/" + fixtureMemberID, "/members/" + fixtureMemberID + "/avatar"} {
		store := &directoryStub{}
		if w := directoryRequest(store, path, ""); w.Code != 401 || store.reads != 0 {
			t.Fatalf("unsigned request reached %s: %d", path, w.Code)
		}
		store.incomplete = true
		if w := directoryRequest(store, path, "valid"); w.Code != 403 || store.reads != 0 {
			t.Fatalf("incomplete account reached %s: %d", path, w.Code)
		}
	}
	store := &directoryStub{}
	if w := directoryRequest(store, "/members?q=+Ada++Lovelace+&page=2", "valid"); w.Code != 200 || store.query != "Ada Lovelace" || store.page != 2 {
		t.Fatalf("directory search failed: %d, %q, %d", w.Code, store.query, store.page)
	}
	if w := directoryRequest(store, "/members?page=wrong", "valid"); w.Code != 400 {
		t.Fatalf("invalid page accepted: %d", w.Code)
	}
}

func TestMemberDetailsUseDatabaseStaffRoleAndRejectBadIDs(t *testing.T) {
	store := &directoryStub{}
	if w := directoryRequest(store, "/members/not-an-id", "valid"); w.Code != 404 || store.reads != 0 {
		t.Fatalf("bad id reached store: %d", w.Code)
	}
	w := directoryRequest(store, "/members/"+fixtureMemberID+"?role=staff", "valid")
	if w.Code != 200 || store.staff || store.targetID != fixtureMemberID || strings.Contains(w.Body.String(), "email") {
		t.Fatalf("browser role or private field leaked: %d %s", w.Code, w.Body.String())
	}
	store.roles = []string{"member", "staff"}
	w = directoryRequest(store, "/members/"+fixtureMemberID+"/avatar", "valid")
	if w.Code != 200 || !store.staff || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("staff avatar access failed: %d", w.Code)
	}
}

func TestIncompleteAccountCanEditProfileButNoCRMFeatures(t *testing.T) {
	store := &profilesStub{incomplete: true, roles: []string{"member", "staff"}}
	for _, path := range []string{"/staff/access", "/events/upcoming", "/points/categories"} {
		r := httptest.NewRequest("GET", path, nil)
		r.Header.Set("Authorization", "Bearer valid")
		w := httptest.NewRecorder()
		NewHandler(nil, "http://localhost:8000", verifiedAuth(), store, nil, nil).ServeHTTP(w, r)
		if w.Code != 403 {
			t.Fatalf("incomplete account reached %s: %d", path, w.Code)
		}
	}
	if w := profileRequest(t, store, "GET", "/profile", "", "valid"); w.Code != 200 {
		t.Fatalf("profile setup blocked: %d", w.Code)
	}
}
