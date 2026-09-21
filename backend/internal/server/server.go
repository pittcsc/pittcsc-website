package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type databasePinger interface {
	Ping(context.Context) error
}

// NewHandler serves database readiness. It does not expose club data or auth APIs.
func NewHandler(db databasePinger, frontendOrigin string) http.Handler {
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
