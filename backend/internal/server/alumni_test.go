package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type alumniStub struct {
	profilesStub
	calls     int
	published bool
	resultErr error
}

func (s *alumniStub) SetAlumniPublication(_ context.Context, id string, p bool) (profile.Record, error) {
	s.calls++
	s.userID = id
	s.published = p
	return profile.Record{AlumniPublished: p}, s.resultErr
}
func (s *alumniStub) ListAlumni(context.Context, profile.DirectoryQuery) (profile.DirectoryPage, error) {
	s.calls++
	return profile.DirectoryPage{Data: []profile.DirectoryRecord{{ID: "directory-id", ContactEmail: "contact@example.org"}}}, s.resultErr
}
func (s *alumniStub) GetAlumnus(context.Context, string) (profile.DirectoryRecord, error) {
	s.calls++
	return profile.DirectoryRecord{}, s.resultErr
}
func (s *alumniStub) AlumniPhoto(context.Context, string) (profile.Asset, error) {
	s.calls++
	return profile.Asset{MediaType: "image/png", Bytes: []byte("photo")}, s.resultErr
}
func alumniRequest(s *alumniStub, method, path, body, token string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), s, nil, nil).ServeHTTP(w, r)
	return w
}
func TestAlumniRoutesRequireActiveVerifiedCRMAccount(t *testing.T) {
	for _, path := range []string{"/alumni", "/alumni/id", "/alumni/id/photo", "/profile/alumni-publication"} {
		method := "GET"
		if path == "/profile/alumni-publication" {
			method = "PUT"
		}
		for _, token := range []string{"", "revoked"} {
			s := &alumniStub{}
			w := alumniRequest(s, method, path, `{"published":true}`, token)
			if w.Code != 401 || s.calls != 0 {
				t.Fatalf("unauthorized route %s: %d", path, w.Code)
			}
		}
		s := &alumniStub{profilesStub: profilesStub{err: profile.ErrSuspended}}
		if w := alumniRequest(s, method, path, `{"published":true}`, "valid"); w.Code != 403 || s.calls != 0 {
			t.Fatal("suspended account reached directory")
		}
		s = &alumniStub{}
		w := alumniRequest(s, method, path, `{"published":true}`, "valid")
		if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("active member denied %s: %d", path, w.Code)
		}
	}
}
func TestPublicationOnlyAcceptsBooleanAndUsesVerifiedOwner(t *testing.T) {
	for _, body := range []string{`{}`, `null`, `{"published":null}`, `{"published":"true"}`, `{"published":true,"userID":"other"}`, `{"published":true} {}`, `{"published":true,"alumniPublished":true}`} {
		s := &alumniStub{}
		if w := alumniRequest(s, "PUT", "/profile/alumni-publication", body, "valid"); w.Code != 400 || s.calls != 0 {
			t.Fatalf("accepted %s: %d", body, w.Code)
		}
	}
	s := &alumniStub{}
	w := alumniRequest(s, "PUT", "/profile/alumni-publication", `{"published":false}`, "valid")
	if w.Code != 200 || s.userID != "verified-owner" || s.published {
		t.Fatal("unpublish did not use verified identity")
	}
	s.resultErr = profile.ErrIneligible
	if w := alumniRequest(s, "PUT", "/profile/alumni-publication", `{"published":true}`, "valid"); w.Code != 409 {
		t.Fatal("ineligible publication must conflict")
	}
}
func TestDirectoryProjectionAndSafeErrors(t *testing.T) {
	s := &alumniStub{}
	w := alumniRequest(s, "GET", "/alumni", "", "valid")
	var data map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil {
		t.Fatal(err)
	}
	for _, private := range []string{`"email"`, `"roles"`, `"auth_user_id"`, `"hasResume"`, `"githubUsername"`} {
		if strings.Contains(w.Body.String(), private) {
			t.Fatalf("private field leaked: %s", private)
		}
	}
	s.resultErr = profile.ErrNotFound
	for _, path := range []string{"/alumni/id", "/alumni/id/photo"} {
		if w := alumniRequest(s, "GET", path, "", "valid"); w.Code != 404 {
			t.Fatal("hidden records must be unavailable")
		}
	}
	s.resultErr = errors.New("secret database detail")
	w = alumniRequest(s, "GET", "/alumni", "", "valid")
	if w.Code != 503 || strings.Contains(w.Body.String(), "secret") {
		t.Fatal("unsafe failure")
	}
}
