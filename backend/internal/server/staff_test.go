package server

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

func TestStaffRoleCombinations(t *testing.T) {
	roles := []string{"member", "foundry", "staff", "alumni"}
	for mask := 0; mask < 16; mask++ {
		assigned := []string{}
		for i, role := range roles {
			if mask&(1<<i) != 0 {
				assigned = append(assigned, role)
			}
		}
		t.Run(strings.Join(assigned, "+"), func(t *testing.T) {
			store := &profilesStub{roles: assigned}
			w := profileRequest(t, store, "GET", "/staff/access?role=staff&userId=other", "", "valid")
			want := 403
			if mask&4 != 0 {
				want = 204
			}
			if w.Code != want || store.userID != "verified-owner" || w.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("staff access status %d, want %d", w.Code, want)
			}
			w = profileRequest(t, store, "GET", "/auth/session", "", "valid")
			var session struct {
				Roles []string `json:"roles"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &session); err != nil || !reflect.DeepEqual(session.Roles, assigned) {
				t.Fatal("session did not return database roles")
			}
		})
	}
}

func TestStaffRevocationAndFailures(t *testing.T) {
	store := &profilesStub{roles: []string{"member", "staff"}}
	h := NewHandler(nil, "http://localhost:8000", verifiedAuth(), store)
	request := func(token string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "/staff/access", nil)
		r.Header.Set("Authorization", token)
		r.Header.Set("X-Role", "staff")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	for _, token := range []string{"", "Bearer forged"} {
		if request(token).Code != 401 || store.userID != "" {
			t.Fatal("unauthorized request reached profile")
		}
	}
	if request("Bearer valid").Code != 204 {
		t.Fatal("staff denied")
	}
	store.roles = []string{"member"}
	if request("Bearer valid").Code != 403 {
		t.Fatal("revoked staff retained access")
	}
	store.roles = []string{"staff"}
	store.err = profile.ErrSuspended
	if request("Bearer valid").Code != 403 {
		t.Fatal("suspended staff retained access")
	}
	store.err = errors.New("private database credentials")
	w := request("Bearer valid")
	if w.Code != 503 || strings.Contains(w.Body.String(), "credentials") {
		t.Fatal("unsafe database failure")
	}
	store.err = nil
	if request("Bearer valid").Code != 204 {
		t.Fatal("recovery failed")
	}
	r := httptest.NewRequest("GET", "/staff/access", nil)
	r.Header.Add("Authorization", "Bearer valid")
	r.Header.Add("Authorization", "Bearer valid")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatal("duplicate credentials accepted")
	}
	for _, method := range []string{"POST", "PUT", "DELETE"} {
		w = httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(method, "/staff/access", nil))
		if w.Code != 405 {
			t.Fatal("unimplemented staff write accepted")
		}
	}
}
