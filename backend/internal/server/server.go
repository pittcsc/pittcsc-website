package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
)

type databasePinger interface {
	Ping(context.Context) error
}

type authenticator interface {
	Authenticate(context.Context, string) (auth.Identity, error)
}

// NewHandler serves readiness and the current verified identity, never CRM data.
func NewHandler(db databasePinger, frontendOrigin string, authentication authenticator) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		if err := db.Ping(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"status": "unavailable", "database": "unavailable",
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status": "ok", "database": "connected",
		})
	})
	mux.HandleFunc("OPTIONS /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /auth/session", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		var identity auth.Identity
		err := auth.ErrUnavailable
		if authentication != nil && len(r.Header.Values("Authorization")) <= 1 {
			identity, err = authentication.Authenticate(ctx, r.Header.Get("Authorization"))
		} else if len(r.Header.Values("Authorization")) > 1 {
			err = auth.ErrUnauthorized
		}
		if err != nil {
			status, message := http.StatusServiceUnavailable, "Authentication is temporarily unavailable. Try again."
			if errors.Is(err, auth.ErrUnauthorized) {
				status, message = http.StatusUnauthorized, "Please sign in again."
				w.Header().Set("WWW-Authenticate", "Bearer")
			}
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
			return
		}
		_ = json.NewEncoder(w).Encode(identity)
	})
	mux.HandleFunc("OPTIONS /auth/session", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		if origin := r.Header.Get("Origin"); origin != "" && origin == frontendOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		}
		mux.ServeHTTP(w, r)
	})
}
