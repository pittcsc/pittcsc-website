package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
	"github.com/pittcsc/pittcsc-website/backend/internal/roles"
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
	h := NewHandler(nil, "http://localhost:8000", verifiedAuth(), store, nil)
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

type roleStoreStub struct {
	calls      int
	actorRoles []string
	search     roles.Search
	actorID    string
	targetID   string
	role       string
	grant      bool
	err        error
}

func (s *roleStoreStub) Catalog(ctx context.Context, actorRoles []string) ([]roles.Role, error) {
	s.calls++
	s.actorRoles = actorRoles
	return []roles.Role{{Name: "staff", Label: "Staff", Editable: true, Confirm: true}}, s.err
}
func (s *roleStoreStub) Search(ctx context.Context, search roles.Search) (roles.Page, error) {
	s.calls++
	s.search = search
	return roles.Page{Users: []roles.Member{{ID: "target", Roles: []string{"member"}}}, Total: 1, Page: search.Page, PageSize: roles.PageSize}, s.err
}
func (s *roleStoreStub) Change(ctx context.Context, actorID, targetID, role string, grant bool) (roles.Member, error) {
	s.calls++
	s.actorID, s.targetID, s.role, s.grant = actorID, targetID, role, grant
	return roles.Member{ID: targetID, Roles: []string{"member", role}}, s.err
}

func staffRequest(t *testing.T, profiles *profilesStub, store *roleStoreStub, method, path, token string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, strings.NewReader(`{"actorId":"forged","grant":true}`))
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	var roleChanges roleStore
	if store != nil {
		roleChanges = store
	}
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), profiles, roleChanges).ServeHTTP(w, r)
	return w
}

var staffRoutes = [][2]string{
	{"GET", "/staff/roles"}, {"GET", "/staff/users?q=ada"},
	{"PUT", "/staff/users/11111111-1111-1111-1111-111111111111/roles/staff"},
	{"DELETE", "/staff/users/11111111-1111-1111-1111-111111111111/roles/foundry"},
}

func TestRoleManagementRequiresCurrentStaff(t *testing.T) {
	for _, route := range staffRoutes {
		t.Run(route[0]+" "+route[1], func(t *testing.T) {
			store := &roleStoreStub{}
			if w := staffRequest(t, &profilesStub{roles: []string{"staff"}}, store, route[0], route[1], ""); w.Code != 401 || store.calls != 0 {
				t.Fatal("anonymous role request reached the store")
			}
			for _, assigned := range [][]string{{"member"}, {"member", "foundry", "alumni"}, {}} {
				if w := staffRequest(t, &profilesStub{roles: assigned}, store, route[0], route[1], "valid"); w.Code != 403 || store.calls != 0 {
					t.Fatalf("%v reached role management", assigned)
				}
			}
			suspended := &profilesStub{roles: []string{"staff"}, err: profile.ErrSuspended}
			if w := staffRequest(t, suspended, store, route[0], route[1], "valid"); w.Code != 403 || store.calls != 0 {
				t.Fatal("suspended staff reached role management")
			}
			w := staffRequest(t, &profilesStub{roles: []string{"member", "staff"}}, store, route[0], route[1], "valid")
			if w.Code != 200 || store.calls != 1 || w.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("staff request failed: %d", w.Code)
			}
			if w := staffRequest(t, &profilesStub{roles: []string{"staff"}}, nil, route[0], route[1], "valid"); w.Code != 503 {
				t.Fatal("missing store must be unavailable")
			}
		})
	}
}

func TestRoleChangesUseVerifiedActorAndPath(t *testing.T) {
	store := &roleStoreStub{}
	staff := &profilesStub{roles: []string{"member", "staff"}}
	w := staffRequest(t, staff, store, "PUT", "/staff/users/target-id/roles/alumni?actorId=forged", "valid")
	if w.Code != 200 || store.actorID != "verified-owner" || store.targetID != "target-id" || store.role != "alumni" || !store.grant {
		t.Fatalf("grant used unverified input: %+v", store)
	}
	var member roles.Member
	if err := json.Unmarshal(w.Body.Bytes(), &member); err != nil || member.ID != "target-id" {
		t.Fatal("grant must return the refreshed member")
	}
	staffRequest(t, staff, store, "DELETE", "/staff/users/target-id/roles/staff", "valid")
	if store.grant || store.role != "staff" || store.actorID != "verified-owner" {
		t.Fatal("DELETE must revoke as the verified actor")
	}
	staffRequest(t, staff, store, "GET", "/staff/roles", "valid")
	if !reflect.DeepEqual(store.actorRoles, []string{"member", "staff"}) {
		t.Fatal("catalog must use current database roles")
	}
	for _, method := range []string{"POST", "PATCH"} {
		if w := staffRequest(t, staff, store, method, "/staff/users/target-id/roles/staff", "valid"); w.Code != 405 {
			t.Fatalf("%s accepted", method)
		}
	}
}

func TestMemberSearchValidation(t *testing.T) {
	store := &roleStoreStub{}
	staff := &profilesStub{roles: []string{"staff"}}
	w := staffRequest(t, staff, store, "GET", "/staff/users?q=+Ada++Lovelace&role=foundry&page=2", "valid")
	if w.Code != 200 || store.search != (roles.Search{Query: "Ada Lovelace", Role: "foundry", Page: 2}) {
		t.Fatalf("search not parsed: %+v", store.search)
	}
	var page roles.Page
	if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil || page.Total != 1 || page.PageSize != 25 || len(page.Users) != 1 {
		t.Fatal("unexpected search response")
	}
	store.calls = 0
	for _, query := range []string{"q=" + strings.Repeat("x", 101), "role=Staff", "page=0", "page=x", "q=%00"} {
		if w := staffRequest(t, staff, store, "GET", "/staff/users?"+query, "valid"); w.Code != 400 || store.calls != 0 {
			t.Fatalf("invalid search %q accepted: %d", query, w.Code)
		}
	}
}

func TestRoleErrorsAreSpecificAndSafe(t *testing.T) {
	for _, tc := range []struct {
		err    error
		status int
		text   string
	}{
		{roles.ErrUnknownRole, 404, "doesn't exist"},
		{roles.ErrReadOnlyRole, 403, "can't be changed"},
		{roles.ErrForbidden, 403, "Staff access"},
		{roles.ErrNotFound, 404, "no longer active"},
		{roles.ErrSelfRevoke, 409, "your own account"},
		{roles.ErrLastHolder, 409, "last active account"},
		{roles.ErrInvalidSearch, 400, "100 characters"},
		{errors.New("private database credentials"), 503, "temporarily unavailable"},
	} {
		store := &roleStoreStub{err: tc.err}
		w := staffRequest(t, &profilesStub{roles: []string{"staff"}}, store, "DELETE", "/staff/users/target-id/roles/staff", "valid")
		if w.Code != tc.status || !strings.Contains(w.Body.String(), tc.text) || strings.Contains(w.Body.String(), "credentials") {
			t.Fatalf("%v: got %d %s", tc.err, w.Code, w.Body.String())
		}
	}
}
