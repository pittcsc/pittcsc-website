package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
	"github.com/pittcsc/pittcsc-website/backend/internal/roles"
)

type roleStore interface {
	Catalog(context.Context, []string) ([]roles.Role, error)
	Search(context.Context, roles.Search) (roles.Page, error)
	Change(ctx context.Context, actorID, targetID, role string, grant bool) (roles.Member, error)
}

// withStaff checks the current database profile/status/roles on every request.
// Future staff operations must use this guard as well as record-specific checks.
func withStaff(authentication authenticator, profiles profileStore, next func(http.ResponseWriter, *http.Request, auth.Identity, profile.Record)) http.HandlerFunc {
	return withStaffTimeout(authentication, profiles, 5*time.Second, next)
}

func withStaffTimeout(authentication authenticator, profiles profileStore, timeout time.Duration, next func(http.ResponseWriter, *http.Request, auth.Identity, profile.Record)) http.HandlerFunc {
	return withProfile(authentication, profiles, timeout, func(w http.ResponseWriter, r *http.Request, identity auth.Identity, record profile.Record) {
		if !slices.Contains(record.Roles, "staff") {
			writeJSONError(w, http.StatusForbidden, "Access restricted. Staff access is required.")
			return
		}
		next(w, r, identity, record)
	})
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}

func writeRoleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, roles.ErrInvalidSearch):
		writeJSONError(w, http.StatusBadRequest, "Search with up to 100 characters, an existing role, and a valid page.")
	case errors.Is(err, roles.ErrUnknownRole):
		writeJSONError(w, http.StatusNotFound, "That role doesn't exist.")
	case errors.Is(err, roles.ErrReadOnlyRole):
		writeJSONError(w, http.StatusForbidden, "This role can't be changed from the dashboard.")
	case errors.Is(err, roles.ErrForbidden):
		writeJSONError(w, http.StatusForbidden, "Access restricted. Staff access is required.")
	case errors.Is(err, roles.ErrNotFound):
		writeJSONError(w, http.StatusNotFound, "That account is no longer active.")
	case errors.Is(err, roles.ErrSelfRevoke):
		writeJSONError(w, http.StatusConflict, "You can't remove this role from your own account.")
	case errors.Is(err, roles.ErrLastHolder):
		writeJSONError(w, http.StatusConflict, "This is the last active account with this role. Grant it to someone else first.")
	default:
		writeJSONError(w, http.StatusServiceUnavailable, "Roles are temporarily unavailable. Try again.")
	}
}

func registerStaffRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore, store roleStore) {
	mux.HandleFunc("GET /staff/access", withStaff(authentication, profiles, func(w http.ResponseWriter, r *http.Request, _ auth.Identity, _ profile.Record) {
		w.WriteHeader(http.StatusNoContent)
	}))
	mux.HandleFunc("GET /staff/roles", withStaff(authentication, profiles, func(w http.ResponseWriter, r *http.Request, _ auth.Identity, record profile.Record) {
		if store == nil {
			writeRoleError(w, auth.ErrUnavailable)
			return
		}
		catalog, err := store.Catalog(r.Context(), record.Roles)
		if err != nil {
			writeRoleError(w, err)
			return
		}
		writeJSON(w, map[string]any{"roles": catalog})
	}))
	mux.HandleFunc("GET /staff/users", withStaff(authentication, profiles, func(w http.ResponseWriter, r *http.Request, _ auth.Identity, _ profile.Record) {
		query := r.URL.Query()
		search, err := roles.ParseSearch(query.Get("q"), query.Get("role"), query.Get("page"))
		if err == nil && store == nil {
			err = auth.ErrUnavailable
		}
		var page roles.Page
		if err == nil {
			page, err = store.Search(r.Context(), search)
		}
		if err != nil {
			writeRoleError(w, err)
			return
		}
		writeJSON(w, page)
	}))
	change := func(grant bool) http.HandlerFunc {
		return withStaff(authentication, profiles, func(w http.ResponseWriter, r *http.Request, identity auth.Identity, _ profile.Record) {
			if store == nil {
				writeRoleError(w, auth.ErrUnavailable)
				return
			}
			member, err := store.Change(r.Context(), identity.ID, r.PathValue("id"), r.PathValue("role"), grant)
			if err != nil {
				writeRoleError(w, err)
				return
			}
			writeJSON(w, member)
		})
	}
	mux.HandleFunc("PUT /staff/users/{id}/roles/{role}", change(true))
	mux.HandleFunc("DELETE /staff/users/{id}/roles/{role}", change(false))
	for _, path := range []string{"/staff/access", "/staff/roles", "/staff/users", "/staff/users/{id}/roles/{role}"} {
		mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	}
}
