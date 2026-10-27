package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pittcsc/pittcsc-website/backend/internal/points"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

const fixtureClaimID = "123e4567-e89b-12d3-a456-426614174000"

type pointsStub struct {
	userID, actorID, claimID, action, reason string
	input                                    points.Input
	createErr                                error
	writes                                   int
}

func (s *pointsStub) Categories(context.Context) ([]points.Category, error) {
	return []points.Category{}, nil
}
func (s *pointsStub) Create(_ context.Context, userID string, input points.Input) (points.Claim, error) {
	s.userID, s.input = userID, input
	s.writes++
	return points.Claim{ID: fixtureClaimID}, s.createErr
}
func (s *pointsStub) Mine(_ context.Context, userID string, _ int) (points.Mine, error) {
	s.userID = userID
	return points.Mine{Claims: []points.Claim{}}, nil
}
func (s *pointsStub) Leaderboard(_ context.Context, userID, period string) (points.Leaderboard, error) {
	s.userID = userID
	if period != "all" && period != "30d" {
		return points.Leaderboard{}, points.ErrInvalid
	}
	return points.Leaderboard{Period: period, Entries: []points.Standing{}}, nil
}
func (s *pointsStub) Foundry(_ context.Context, userID string) (points.FoundryStatus, error) {
	s.userID = userID
	return points.NewFoundryStatus("Ada Lovelace", 20, nil), nil
}
func (s *pointsStub) Withdraw(_ context.Context, userID, claimID string) (points.Claim, error) {
	s.userID, s.claimID = userID, claimID
	return points.Claim{ID: claimID, Status: "withdrawn"}, nil
}
func (s *pointsStub) StaffList(context.Context, int) (points.StaffPage, error) {
	return points.StaffPage{Claims: []points.Claim{}}, nil
}
func (s *pointsStub) Moderate(_ context.Context, actorID, claimID, action, reason string) (points.Claim, error) {
	s.actorID, s.claimID, s.action, s.reason = actorID, claimID, action, reason
	return points.Claim{ID: claimID}, nil
}
func (s *pointsStub) Correct(_ context.Context, actorID, claimID string, _ points.Correction) (points.Claim, error) {
	s.actorID, s.claimID = actorID, claimID
	return points.Claim{ID: claimID}, nil
}

func pointRequest(roles []string, store *pointsStub, method, path, body, token string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), &profilesStub{roles: roles}, nil, nil, store).ServeHTTP(w, r)
	return w
}

func TestPointClaimsRequireIdentityAndAcceptOnlyAllowedFields(t *testing.T) {
	s := &pointsStub{}
	valid := `{"category":"paper","url":"https://example.org/paper","affirmed":true}`
	if w := pointRequest(nil, s, "POST", "/points/claims", valid, ""); w.Code != 401 || s.writes != 0 {
		t.Fatal("anonymous claim accepted")
	}
	for _, body := range []string{
		`{"category":"paper","url":"https://example.org/paper","affirmed":true,"userID":"someone-else"}`,
		`{"category":"paper","url":"https://example.org/paper","affirmed":true,"points":1000}`,
		`null`, `{} {}`,
	} {
		if w := pointRequest(nil, s, "POST", "/points/claims", body, "valid"); w.Code != 400 || s.writes != 0 {
			t.Fatalf("invalid payload accepted: %d", w.Code)
		}
	}
	w := pointRequest(nil, s, "POST", "/points/claims", valid, "valid")
	if w.Code != 201 || s.userID != "verified-owner" || !s.input.Affirmed || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("claim failed: %d", w.Code)
	}
	s.createErr = points.ErrDuplicate
	if w := pointRequest(nil, s, "POST", "/points/claims", valid, "valid"); w.Code != 409 {
		t.Fatal("duplicate did not conflict")
	}
	if w := pointRequest(nil, s, "DELETE", "/points/claims/"+fixtureClaimID, "", "valid"); w.Code != 200 || s.userID != "verified-owner" {
		t.Fatal("withdraw did not use verified owner")
	}
	if w := pointRequest(nil, s, "DELETE", "/points/claims/not-a-uuid", "", "valid"); w.Code != 400 {
		t.Fatal("invalid claim ID accepted")
	}
}

func TestLeaderboardAndModerationAuthorization(t *testing.T) {
	s := &pointsStub{}
	if w := pointRequest(nil, s, "GET", "/points/leaderboard?period=30d", "", "valid"); w.Code != 200 || s.userID != "verified-owner" {
		t.Fatal("member leaderboard failed")
	}
	if w := pointRequest(nil, s, "GET", "/points/leaderboard?period=year", "", "valid"); w.Code != 400 {
		t.Fatal("invalid period accepted")
	}
	path := "/staff/points/claims/" + fixtureClaimID + "/revoke"
	if w := pointRequest(nil, s, "POST", path, `{"reason":"Duplicate"}`, "valid"); w.Code != 403 || s.actorID != "" {
		t.Fatal("member reached moderation")
	}
	if w := pointRequest([]string{"staff"}, s, "POST", path, `{"reason":"Duplicate"}`, ""); w.Code != 401 || s.actorID != "" {
		t.Fatal("anonymous moderation accepted")
	}
	if w := pointRequest([]string{"staff"}, s, "POST", path, `{"reason":""}`, "valid"); w.Code != 400 || s.actorID != "" {
		t.Fatal("empty moderation reason accepted")
	}
	if w := pointRequest([]string{"staff"}, s, "POST", path, `{"reason":"Duplicate"}`, "valid"); w.Code != 200 || s.actorID != "verified-owner" || s.action != "revoke" {
		t.Fatal("staff moderation failed")
	}
	if w := pointRequest([]string{"staff"}, s, "GET", "/staff/points/claims", "", "valid"); w.Code != 200 {
		t.Fatal("staff list failed")
	}
	r := httptest.NewRequest("OPTIONS", "/points/claims", nil)
	r.Header.Set("Origin", "http://localhost:8000")
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), &profilesStub{}, nil, nil, s).ServeHTTP(w, r)
	if w.Code != http.StatusNoContent || !strings.Contains(w.Header().Get("Access-Control-Allow-Methods"), "POST") {
		t.Fatal("points preflight failed")
	}
}

func TestFoundryStatusUsesVerifiedOwner(t *testing.T) {
	s := &pointsStub{}
	if w := pointRequest(nil, s, "GET", "/points/foundry", "", ""); w.Code != 401 || s.userID != "" {
		t.Fatal("anonymous Foundry status returned")
	}
	if w := pointRequest(nil, s, "GET", "/points/foundry?userID=someone-else", "", "invalid"); w.Code != 401 || s.userID != "" {
		t.Fatal("unverified Foundry status returned")
	}
	w := pointRequest(nil, s, "GET", "/points/foundry?userID=someone-else", "", "valid")
	if w.Code != 200 || s.userID != "verified-owner" || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("Foundry status failed: %d", w.Code)
	}
	for _, profiles := range []*profilesStub{{err: profile.ErrSuspended}, {incomplete: true}} {
		denied := &pointsStub{}
		r := httptest.NewRequest("GET", "/points/foundry", nil)
		r.Header.Set("Authorization", "Bearer valid")
		recorder := httptest.NewRecorder()
		NewHandler(nil, "http://localhost:8000", verifiedAuth(), profiles, nil, nil, denied).ServeHTTP(recorder, r)
		if recorder.Code != 403 || denied.userID != "" {
			t.Fatalf("inactive or incomplete account reached Foundry status: %d", recorder.Code)
		}
	}
	body := w.Body.String()
	if !strings.Contains(body, `"points":20`) || !strings.Contains(body, `"threshold":50`) || !strings.Contains(body, `"active":false`) || !strings.Contains(body, `"windowDays":30`) {
		t.Fatalf("unexpected Foundry status: %s", body)
	}
}
