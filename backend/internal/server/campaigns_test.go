package server

import (
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEmailRoutesRequireCurrentStaff(t *testing.T) {
	routes := []struct{ method, path string }{{"GET", "/staff/email/contacts"}, {"GET", "/staff/email/campaigns"}, {"PUT", "/staff/email/campaigns/new"}, {"POST", "/staff/email/import/preview"}, {"POST", "/staff/email/assets"}, {"GET", "/staff/email/export/contacts"}, {"POST", "/staff/email/audiences"}}
	for _, route := range routes {
		for _, roles := range [][]string{{"member"}, {"alumni", "foundry"}, {"staff"}} {
			p := &profilesStub{roles: roles}
			h := NewHandler(nil, "http://localhost:8000", verifiedAuth(), p, nil, nil)
			r := httptest.NewRequest(route.method, route.path, strings.NewReader(`{}`))
			r.Header.Set("Authorization", "Bearer valid")
			r.Header.Set("X-Role", "staff")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			want := 403
			if len(roles) == 1 && roles[0] == "staff" {
				want = 409
			}
			if w.Code != want {
				t.Fatalf("%s %s: got %d want %d", route.method, route.path, w.Code, want)
			}
			p.err = profile.ErrSuspended
			w = httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != 403 {
				t.Fatal("suspended staff retained email access")
			}
		}
	}
}
func TestEmailPublicAndMemberBoundaries(t *testing.T) {
	h := NewHandler(nil, "http://localhost:8000", verifiedAuth(), &profilesStub{roles: []string{"member"}}, nil, nil)
	for _, path := range []string{"/profile/email-subscription", "/staff/email/status"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 401 {
			t.Fatal("private email route allowed anonymous access")
		}
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/email/preferences", nil))
	if w.Code != 200 || !strings.Contains(w.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'") {
		t.Fatal("accountless preference landing unavailable or unsafe")
	}
}
