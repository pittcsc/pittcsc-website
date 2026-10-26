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

type alumniStore interface {
	SetAlumniPublication(context.Context, string, bool) (profile.Record, error)
	ListAlumni(context.Context, profile.DirectoryQuery) (profile.DirectoryPage, error)
	GetAlumnus(context.Context, string) (profile.DirectoryRecord, error)
	AlumniPhoto(context.Context, string) (profile.Asset, error)
}

func writeAlumniError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, profile.ErrNotFound):
		writeJSONError(w, 404, "That AlumniDB profile is not available.")
	case errors.Is(err, profile.ErrInvalid):
		writeJSONError(w, 400, "Check the directory search, filters and page.")
	case errors.Is(err, profile.ErrIneligible):
		writeJSONError(w, 409, "Complete all AlumniDB fields, add a photo and at least one kind of help, and use a graduation year no later than the current year before publishing.")
	default:
		writeProfileError(w, err)
	}
}
func registerAlumniRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore) {
	store, ok := profiles.(alumniStore)
	guard := func(next func(http.ResponseWriter, *http.Request, auth.Identity)) http.HandlerFunc {
		return withProfile(authentication, profiles, 8*time.Second, func(w http.ResponseWriter, r *http.Request, id auth.Identity, _ profile.Record) {
			if !ok {
				writeProfileError(w, auth.ErrUnavailable)
				return
			}
			next(w, r, id)
		})
	}
	mux.HandleFunc("PUT /profile/alumni-publication", guard(func(w http.ResponseWriter, r *http.Request, id auth.Identity) {
		media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || media != "application/json" {
			writeJSONError(w, 415, "Send publication as JSON.")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1024)
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		var input *struct {
			Published *bool `json:"published"`
		}
		if err := dec.Decode(&input); err != nil || input == nil || input.Published == nil {
			writeJSONError(w, 400, "Send a published boolean.")
			return
		}
		if dec.Decode(new(any)) != io.EOF {
			writeJSONError(w, 400, "Send one publication object.")
			return
		}
		record, err := store.SetAlumniPublication(r.Context(), id.ID, *input.Published)
		if err != nil {
			writeAlumniError(w, err)
			return
		}
		writeProfile(w, record, id)
	}))
	mux.HandleFunc("GET /alumni", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		q, err := profile.ParseDirectoryQuery(r.URL.Query())
		if err != nil {
			writeAlumniError(w, err)
			return
		}
		page, err := store.ListAlumni(r.Context(), q)
		if err != nil {
			writeAlumniError(w, err)
			return
		}
		writeJSON(w, page)
	}))
	mux.HandleFunc("GET /alumni/{id}", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		d, err := store.GetAlumnus(r.Context(), r.PathValue("id"))
		if err != nil {
			writeAlumniError(w, err)
			return
		}
		writeJSON(w, d)
	}))
	mux.HandleFunc("GET /alumni/{id}/photo", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		a, err := store.AlumniPhoto(r.Context(), r.PathValue("id"))
		if err != nil {
			writeAlumniError(w, err)
			return
		}
		w.Header().Set("Content-Type", a.MediaType)
		w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		_, _ = w.Write(a.Bytes)
	}))
	for _, path := range []string{"/profile/alumni-publication", "/alumni", "/alumni/{id}", "/alumni/{id}/photo"} {
		mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	}
}
