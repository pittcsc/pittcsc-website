package server

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"slices"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type directoryStore interface {
	Directory(context.Context, string, int) (profile.DirectoryPage, error)
	PublicMember(context.Context, string, bool) (profile.PublicMember, error)
	MemberAvatar(context.Context, string, bool) (profile.Asset, error)
}

var memberIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func writeDirectoryError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, profile.ErrInvalidSearch):
		writeJSONError(w, http.StatusBadRequest, "Search names with up to 100 characters and a valid page.")
	case errors.Is(err, profile.ErrMemberNotFound):
		writeJSONError(w, http.StatusNotFound, "This member profile is unavailable.")
	default:
		writeJSONError(w, http.StatusServiceUnavailable, "Members are temporarily unavailable. Try again.")
	}
}

func registerDirectoryRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore) {
	store, _ := profiles.(directoryStore)
	member := func(next func(http.ResponseWriter, *http.Request, bool)) http.HandlerFunc {
		return withCompleteProfile(authentication, profiles, 5*time.Second, func(w http.ResponseWriter, r *http.Request, _ auth.Identity, record profile.Record) {
			if store == nil {
				writeDirectoryError(w, auth.ErrUnavailable)
				return
			}
			next(w, r, slices.Contains(record.Roles, "staff"))
		})
	}
	mux.HandleFunc("GET /members", member(func(w http.ResponseWriter, r *http.Request, _ bool) {
		query, page, err := profile.ParseDirectorySearch(r.URL.Query().Get("q"), r.URL.Query().Get("page"))
		if err != nil {
			writeDirectoryError(w, err)
			return
		}
		result, err := store.Directory(r.Context(), query, page)
		if err != nil {
			writeDirectoryError(w, err)
			return
		}
		writeJSON(w, result)
	}))
	mux.HandleFunc("GET /members/{id}", member(func(w http.ResponseWriter, r *http.Request, staff bool) {
		if !memberIDPattern.MatchString(r.PathValue("id")) {
			writeDirectoryError(w, profile.ErrMemberNotFound)
			return
		}
		result, err := store.PublicMember(r.Context(), r.PathValue("id"), staff)
		if err != nil {
			writeDirectoryError(w, err)
			return
		}
		writeJSON(w, result)
	}))
	mux.HandleFunc("GET /members/{id}/avatar", member(func(w http.ResponseWriter, r *http.Request, staff bool) {
		if !memberIDPattern.MatchString(r.PathValue("id")) {
			writeDirectoryError(w, profile.ErrMemberNotFound)
			return
		}
		asset, err := store.MemberAvatar(r.Context(), r.PathValue("id"), staff)
		if err != nil {
			writeDirectoryError(w, err)
			return
		}
		w.Header().Set("Content-Type", asset.MediaType)
		w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		_, _ = w.Write(asset.Bytes)
	}))
	for _, path := range []string{"/members", "/members/{id}", "/members/{id}/avatar"} {
		mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	}
}
