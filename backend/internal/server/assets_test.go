package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type assetStub struct {
	profilesStub
	asset               profile.Asset
	fileOwner, fileKind string
	puts, deletes       int
	fileError           error
}

func (s *assetStub) PutAsset(_ context.Context, owner, kind, media string, data []byte) error {
	s.fileOwner, s.fileKind, s.asset = owner, kind, profile.Asset{MediaType: media, Bytes: data}
	s.puts++
	return s.fileError
}
func (s *assetStub) GetAsset(_ context.Context, owner, kind string) (profile.Asset, error) {
	s.fileOwner, s.fileKind = owner, kind
	return s.asset, s.fileError
}
func (s *assetStub) DeleteAsset(_ context.Context, owner, kind string) error {
	s.fileOwner, s.fileKind = owner, kind
	s.deletes++
	return s.fileError
}
func assetRequest(store *assetStub, method, path, body, contentType, token string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", contentType)
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), store, nil).ServeHTTP(w, r)
	return w
}
func TestAssetRoutes(t *testing.T) {
	store := &assetStub{}
	pdf := "%PDF-1.4\nfixture\n%%EOF"
	for range 2 {
		w := assetRequest(store, "PUT", "/profile/resume", pdf, "application/pdf", "valid")
		if w.Code != 204 || store.fileOwner != "verified-owner" || store.fileKind != "resume" {
			t.Fatalf("upload failed: %d", w.Code)
		}
	}
	w := assetRequest(store, "GET", "/profile/resume?userId=someone-else", "", "", "valid")
	if w.Code != 200 || w.Body.String() != pdf || store.fileOwner != "verified-owner" {
		t.Fatal("owner download failed")
	}
	if w.Header().Get("Content-Disposition") != `attachment; filename="resume.pdf"` || w.Header().Get("X-Content-Type-Options") != "nosniff" || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("unsafe download headers")
	}
	for range 2 {
		if w := assetRequest(store, "DELETE", "/profile/resume", "", "", "valid"); w.Code != 204 {
			t.Fatal("delete failed")
		}
	}
	if store.deletes != 2 {
		t.Fatal("delete did not reach store")
	}
}
func TestAssetDeniedRequestsAndFailures(t *testing.T) {
	for _, kind := range []string{"resume"} {
		for _, method := range []string{"GET", "PUT", "DELETE"} {
			store := &assetStub{}
			w := assetRequest(store, method, "/profile/"+kind, "", "", "")
			if w.Code != 401 || store.fileOwner != "" {
				t.Fatal("unauthenticated asset access")
			}
			store.err = profile.ErrSuspended
			w = assetRequest(store, method, "/profile/"+kind, "", "", "valid")
			if w.Code != 403 || store.fileOwner != "" {
				t.Fatal("suspended asset access")
			}
		}
	}
	for _, tc := range []struct {
		err    error
		status int
	}{
		{profile.ErrNotFound, 404}, {errors.New("secret storage details"), 503},
	} {
		w := assetRequest(&assetStub{fileError: tc.err}, "GET", "/profile/resume", "", "", "valid")
		if w.Code != tc.status || strings.Contains(w.Body.String(), "secret storage") {
			t.Fatal("unsafe storage failure")
		}
	}
	store := &assetStub{}
	for _, tc := range []struct {
		path, body, media string
		status            int
	}{
		{"/profile/resume", "<svg/>", "image/svg+xml", 415},
		{"/profile/resume", "not a PDF", "image/png", 415},
		{"/profile/resume", "not a PDF", "application/pdf", 400},
		{"/profile/resume", strings.Repeat("a", profile.ResumeLimit+1), "application/pdf", 413},
	} {
		w := assetRequest(store, "PUT", tc.path, tc.body, tc.media, "valid")
		if w.Code != tc.status || store.puts != 0 {
			t.Fatalf("invalid upload accepted: got %d want %d", w.Code, tc.status)
		}
	}
	w := assetRequest(store, http.MethodGet, "/profile/other-owner/resume", "", "", "valid")
	if w.Code != 404 {
		t.Fatal("unexpected other-user asset route")
	}
}

func TestAvatarRoutesRemoved(t *testing.T) {
	for _, token := range []string{"", "valid"} {
		for _, method := range []string{"GET", "PUT", "DELETE", "OPTIONS"} {
			store := &assetStub{}
			w := assetRequest(store, method, "/profile/avatar", "", "image/png", token)
			if w.Code != 404 || store.fileOwner != "" || store.puts != 0 || store.deletes != 0 {
				t.Fatalf("removed image route reached storage: %s status %d", method, w.Code)
			}
		}
	}
}
