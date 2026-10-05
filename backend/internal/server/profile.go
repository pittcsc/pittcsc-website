package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type profileStore interface {
	GetOrCreate(context.Context, string) (profile.Record, error)
	Update(context.Context, string, profile.Input) (profile.Record, error)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func writeProfileError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrUnauthorized):
		w.Header().Set("WWW-Authenticate", "Bearer")
		writeJSONError(w, http.StatusUnauthorized, "Please sign in again.")
	case errors.Is(err, profile.ErrSuspended):
		writeJSONError(w, http.StatusForbidden, "Your account is suspended. Contact Pitt CSC staff.")
	case errors.Is(err, profile.ErrInvalid):
		writeJSONError(w, http.StatusBadRequest, "Check your profile fields. Names can have up to 100 characters, graduation year must be 1900–2100, and you can add up to eight distinct majors of 120 characters each.")
	case errors.Is(err, profile.ErrNotFound):
		writeJSONError(w, http.StatusNotFound, "This file has not been uploaded.")
	case errors.Is(err, profile.ErrFileTooLarge):
		writeJSONError(w, http.StatusRequestEntityTooLarge, "Choose a PDF resume up to 10 MB.")
	case errors.Is(err, profile.ErrInvalidFile):
		writeJSONError(w, http.StatusBadRequest, "Choose a valid PDF resume.")
	default:
		writeJSONError(w, http.StatusServiceUnavailable, "Your account is temporarily unavailable. Try again.")
	}
}

func withProfile(authentication authenticator, profiles profileStore, timeout time.Duration, next func(http.ResponseWriter, *http.Request, auth.Identity, profile.Record)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		r = r.WithContext(ctx)
		if len(r.Header.Values("Authorization")) > 1 {
			writeProfileError(w, auth.ErrUnauthorized)
			return
		}
		if authentication == nil || profiles == nil {
			writeProfileError(w, auth.ErrUnavailable)
			return
		}
		identity, err := authentication.Authenticate(ctx, r.Header.Get("Authorization"))
		if err != nil {
			writeProfileError(w, err)
			return
		}
		record, err := profiles.GetOrCreate(ctx, identity.ID)
		if err != nil {
			writeProfileError(w, err)
			return
		}
		next(w, r, identity, record)
	}
}

func writeProfile(w http.ResponseWriter, record profile.Record, identity auth.Identity) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		profile.Record
		Email string `json:"email"`
	}{record, identity.Email})
}

func registerProfileRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore) {
	mux.HandleFunc("GET /profile", withProfile(authentication, profiles, 5*time.Second, func(w http.ResponseWriter, r *http.Request, identity auth.Identity, record profile.Record) {
		writeProfile(w, record, identity)
	}))
	mux.HandleFunc("PUT /profile", withProfile(authentication, profiles, 5*time.Second, func(w http.ResponseWriter, r *http.Request, identity auth.Identity, _ profile.Record) {
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, http.StatusUnsupportedMediaType, "Send profile fields as JSON.")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		var input *profile.Input
		if err := decoder.Decode(&input); err != nil || input == nil {
			writeJSONError(w, http.StatusBadRequest, "Send only editable profile fields in a valid JSON object.")
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			writeJSONError(w, http.StatusBadRequest, "Send one profile object.")
			return
		}
		if err := input.Validate(); err != nil {
			writeProfileError(w, err)
			return
		}
		record, err := profiles.Update(r.Context(), identity.ID, *input)
		if err != nil {
			writeProfileError(w, err)
			return
		}
		writeProfile(w, record, identity)
	}))
	mux.HandleFunc("OPTIONS /profile", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
}
