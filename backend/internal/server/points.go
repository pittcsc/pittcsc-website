package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"regexp"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/points"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type pointStore interface {
	Categories(context.Context) ([]points.Category, error)
	Create(context.Context, string, points.Input) (points.Claim, error)
	Mine(context.Context, string, int) (points.Mine, error)
	Leaderboard(context.Context, string, string) (points.Leaderboard, error)
	Withdraw(context.Context, string, string) (points.Claim, error)
	StaffList(context.Context, int) (points.StaffPage, error)
	Moderate(context.Context, string, string, string, string) (points.Claim, error)
	Correct(context.Context, string, string, points.Correction) (points.Claim, error)
}

var pointClaimID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func writePointError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, points.ErrInvalid):
		writeJSONError(w, 400, "Choose a valid category and HTTPS link, confirm the activity, and check any reason or page number.")
	case errors.Is(err, points.ErrDuplicate):
		writeJSONError(w, 409, "You have already claimed that link. Each link can earn points once per person.")
	case errors.Is(err, points.ErrNotFound):
		writeJSONError(w, 404, "That point claim was not found.")
	case errors.Is(err, points.ErrConflict):
		writeJSONError(w, 409, "That claim changed. Reload it and try again.")
	default:
		writeJSONError(w, 503, "Points are temporarily unavailable. Try again.")
	}
}

func decodePointBody(w http.ResponseWriter, r *http.Request, value any) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		writeJSONError(w, 415, "Send point fields as JSON.")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		writeJSONError(w, 400, "Send only allowed point fields in one JSON object.")
		return false
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		writeJSONError(w, 400, "Send one point object.")
		return false
	}
	return true
}

func registerPointRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore, store pointStore) {
	member := func(next func(http.ResponseWriter, *http.Request, auth.Identity)) http.HandlerFunc {
		return withProfile(authentication, profiles, 5*time.Second, func(w http.ResponseWriter, r *http.Request, identity auth.Identity, _ profile.Record) {
			if store == nil {
				writePointError(w, auth.ErrUnavailable)
				return
			}
			next(w, r, identity)
		})
	}
	staff := func(next func(http.ResponseWriter, *http.Request, auth.Identity)) http.HandlerFunc {
		return withStaff(authentication, profiles, func(w http.ResponseWriter, r *http.Request, identity auth.Identity, _ profile.Record) {
			if store == nil {
				writePointError(w, auth.ErrUnavailable)
				return
			}
			next(w, r, identity)
		})
	}
	mux.HandleFunc("GET /points/categories", member(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		items, err := store.Categories(r.Context())
		if err != nil {
			writePointError(w, err)
			return
		}
		writeJSON(w, map[string]any{"categories": items})
	}))
	mux.HandleFunc("GET /points/me", member(func(w http.ResponseWriter, r *http.Request, identity auth.Identity) {
		page, err := points.ParsePage(r.URL.Query().Get("page"))
		if err != nil {
			writePointError(w, err)
			return
		}
		result, err := store.Mine(r.Context(), identity.ID, page)
		if err != nil {
			writePointError(w, err)
			return
		}
		writeJSON(w, result)
	}))
	mux.HandleFunc("GET /points/leaderboard", member(func(w http.ResponseWriter, r *http.Request, identity auth.Identity) {
		period := r.URL.Query().Get("period")
		if period == "" {
			period = "all"
		}
		result, err := store.Leaderboard(r.Context(), identity.ID, period)
		if err != nil {
			writePointError(w, err)
			return
		}
		writeJSON(w, result)
	}))
	mux.HandleFunc("POST /points/claims", member(func(w http.ResponseWriter, r *http.Request, identity auth.Identity) {
		var input *points.Input
		if !decodePointBody(w, r, &input) {
			return
		}
		if input == nil {
			writePointError(w, points.ErrInvalid)
			return
		}
		if !input.Affirmed {
			writePointError(w, points.ErrInvalid)
			return
		}
		if _, err := points.NormalizeURL(input.Category, input.URL); err != nil {
			writePointError(w, err)
			return
		}
		claim, err := store.Create(r.Context(), identity.ID, *input)
		if err != nil {
			writePointError(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		writeJSON(w, claim)
	}))
	mux.HandleFunc("DELETE /points/claims/{id}", member(func(w http.ResponseWriter, r *http.Request, identity auth.Identity) {
		if !pointClaimID.MatchString(r.PathValue("id")) {
			writePointError(w, points.ErrInvalid)
			return
		}
		claim, err := store.Withdraw(r.Context(), identity.ID, r.PathValue("id"))
		if err != nil {
			writePointError(w, err)
			return
		}
		writeJSON(w, claim)
	}))
	mux.HandleFunc("GET /staff/points/claims", staff(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		page, err := points.ParsePage(r.URL.Query().Get("page"))
		if err != nil {
			writePointError(w, err)
			return
		}
		result, err := store.StaffList(r.Context(), page)
		if err != nil {
			writePointError(w, err)
			return
		}
		writeJSON(w, result)
	}))
	moderate := func(action string) http.HandlerFunc {
		return staff(func(w http.ResponseWriter, r *http.Request, identity auth.Identity) {
			if !pointClaimID.MatchString(r.PathValue("id")) {
				writePointError(w, points.ErrInvalid)
				return
			}
			var input *struct {
				Reason string `json:"reason"`
			}
			if !decodePointBody(w, r, &input) {
				return
			}
			if input == nil {
				writePointError(w, points.ErrInvalid)
				return
			}
			if _, err := points.ValidReason(input.Reason); err != nil {
				writePointError(w, err)
				return
			}
			claim, err := store.Moderate(r.Context(), identity.ID, r.PathValue("id"), action, input.Reason)
			if err != nil {
				writePointError(w, err)
				return
			}
			writeJSON(w, claim)
		})
	}
	mux.HandleFunc("POST /staff/points/claims/{id}/revoke", moderate("revoke"))
	mux.HandleFunc("POST /staff/points/claims/{id}/restore", moderate("restore"))
	mux.HandleFunc("PUT /staff/points/claims/{id}", staff(func(w http.ResponseWriter, r *http.Request, identity auth.Identity) {
		if !pointClaimID.MatchString(r.PathValue("id")) {
			writePointError(w, points.ErrInvalid)
			return
		}
		var input *points.Correction
		if !decodePointBody(w, r, &input) {
			return
		}
		if input == nil {
			writePointError(w, points.ErrInvalid)
			return
		}
		if _, err := points.ValidReason(input.Reason); err != nil {
			writePointError(w, err)
			return
		}
		if _, err := points.NormalizeURL(input.Category, input.URL); err != nil {
			writePointError(w, err)
			return
		}
		claim, err := store.Correct(r.Context(), identity.ID, r.PathValue("id"), *input)
		if err != nil {
			writePointError(w, err)
			return
		}
		writeJSON(w, claim)
	}))
	for _, path := range []string{
		"/points/categories", "/points/me", "/points/leaderboard", "/points/claims", "/points/claims/{id}",
		"/staff/points/claims", "/staff/points/claims/{id}", "/staff/points/claims/{id}/revoke", "/staff/points/claims/{id}/restore",
	} {
		mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	}
}
