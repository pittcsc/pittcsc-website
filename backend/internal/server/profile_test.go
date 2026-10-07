package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type profilesStub struct {
	roles  []string
	userID string
	input  profile.Input
	err    error
	writes int
}

func (s *profilesStub) GetOrCreate(ctx context.Context, id string) (profile.Record, error) {
	s.userID = id
	return profile.Record{Majors: []string{}, Roles: s.roles}, s.err
}
func (s *profilesStub) Update(ctx context.Context, id string, input profile.Input) (profile.Record, error) {
	s.userID, s.input = id, input
	s.writes++
	return profile.Record{FirstName: input.FirstName, Majors: input.Majors}, s.err
}
func verifiedAuth() authenticator {
	return authenticateFunc(func(ctx context.Context, header string) (auth.Identity, error) {
		if header != "Bearer valid" {
			return auth.Identity{}, auth.ErrUnauthorized
		}
		return auth.Identity{ID: "verified-owner", Email: "fixture@pitt.edu"}, nil
	})
}
func profileRequest(t *testing.T, store *profilesStub, method, path, body, token string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), store, nil).ServeHTTP(w, r)
	return w
}

func TestProfileAuthorizationAndProvisioning(t *testing.T) {
	for _, path := range []string{"/auth/session", "/profile"} {
		t.Run(path, func(t *testing.T) {
			store := &profilesStub{}
			if w := profileRequest(t, store, "GET", path, "", ""); w.Code != 401 || store.userID != "" {
				t.Fatal("unauthenticated request reached profiles")
			}
			w := profileRequest(t, store, "GET", path, "", "valid")
			if w.Code != 200 || store.userID != "verified-owner" || w.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("unexpected response: %d", w.Code)
			}
			for _, tc := range []struct {
				err    error
				status int
			}{
				{profile.ErrSuspended, 403}, {errors.New("private database details"), 503},
			} {
				store.err = tc.err
				w := profileRequest(t, store, "GET", path, "", "valid")
				if w.Code != tc.status || strings.Contains(w.Body.String(), "private database") {
					t.Fatal("unsafe profile failure")
				}
			}
		})
	}
}

func TestProfileEditableFields(t *testing.T) {
	for _, body := range []string{
		`{"roles":["staff"]}`, `{"auth_user_id":"someone-else"}`, `{"id":"someone-else"}`,
		`{"account_status":"active"}`, `{"email":"new@pitt.edu"}`, `{"resume_asset_id":"other-file"}`,
		`{"graduationYear":2028.5}`, `{"graduationYear":"2028"}`, `{"majors":[""]}`,
		`{"firstName":"` + strings.Repeat("x", 101) + `"}`, `null`, `{}`, // empty object is allowed below
		`{} {}`, `{"firstName":`,
	} {
		t.Run(body[:min(len(body), 35)], func(t *testing.T) {
			store := &profilesStub{}
			w := profileRequest(t, store, "PUT", "/profile", body, "valid")
			if body == "{}" {
				if w.Code != 200 || store.writes != 1 {
					t.Fatal("empty profile must be saveable")
				}
			} else if w.Code != 400 || store.writes != 0 {
				t.Fatalf("invalid fields accepted: %d", w.Code)
			}
		})
	}
	store := &profilesStub{}
	w := profileRequest(t, store, "PUT", "/profile", `{"firstName":" Test ","majors":["Math","Computer Science"]}`, "valid")
	if w.Code != 200 || store.userID != "verified-owner" || *store.input.FirstName != "Test" {
		t.Fatalf("partial save failed: %d", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["email"] != "fixture@pitt.edu" {
		t.Fatal("email must come from current Auth identity")
	}
}

func TestProfileRequestLimitsAndPreflight(t *testing.T) {
	h := NewHandler(nil, "http://localhost:8000", verifiedAuth(), &profilesStub{}, nil)
	r := httptest.NewRequest("PUT", "/profile", strings.NewReader(`{}`))
	r.Header.Set("Authorization", "Bearer valid")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 415 {
		t.Fatal("missing content type accepted")
	}
	r = httptest.NewRequest("GET", "/profile", nil)
	r.Header.Add("Authorization", "Bearer valid")
	r.Header.Add("Authorization", "Bearer valid")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatal("duplicate authorization headers accepted")
	}
	r = httptest.NewRequest("OPTIONS", "/profile", nil)
	r.Header.Set("Origin", "http://localhost:8000")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusNoContent || !strings.Contains(w.Header().Get("Access-Control-Allow-Methods"), "PUT") {
		t.Fatal("profile preflight failed")
	}
	large := `{"firstName":"` + strings.Repeat("a", 17000) + `"}`
	if w := profileRequest(t, &profilesStub{}, "PUT", "/profile", large, "valid"); w.Code != 400 {
		t.Fatal("large payload accepted")
	}
}
