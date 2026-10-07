package server

import (
	"net/http"
	"slices"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

// withStaff checks the current database profile/status/roles on every request.
// Future staff operations must use this guard as well as record-specific checks.
func withStaff(authentication authenticator, profiles profileStore, next func(http.ResponseWriter, *http.Request, auth.Identity)) http.HandlerFunc {
	return withProfile(authentication, profiles, 5*time.Second, func(w http.ResponseWriter, r *http.Request, identity auth.Identity, record profile.Record) {
		if !slices.Contains(record.Roles, "staff") {
			writeJSONError(w, http.StatusForbidden, "Access restricted. Staff access is required.")
			return
		}
		next(w, r, identity)
	})
}

func registerStaffRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore) {
	mux.HandleFunc("GET /staff/access", withStaff(authentication, profiles, func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		w.WriteHeader(http.StatusNoContent)
	}))
	mux.HandleFunc("OPTIONS /staff/access", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
}
