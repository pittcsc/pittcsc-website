package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/events"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type eventStore interface {
	List(context.Context, string, int) (events.Page, error)
	Get(context.Context, string) (events.Event, error)
	History(context.Context, string, int64) (events.History, error)
	Save(context.Context, string, string, events.Input) (events.Event, error)
	Cancel(context.Context, string, string, int) (events.Event, error)
	Sync(context.Context, string, string) (events.Event, error)
}

func writeEventError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, events.ErrInvalid):
		writeJSONError(w, 400, "Check the event fields: title (200 characters), location (500), optional description (5,000), and a valid list page.")
	case errors.Is(err, events.ErrTime):
		writeJSONError(w, 400, "Use valid New York dates and times from 2000–2100, with the end after the start. Times skipped or repeated during daylight-saving changes cannot be used.")
	case errors.Is(err, events.ErrNotFound):
		writeJSONError(w, 404, "That event was not found.")
	case errors.Is(err, events.ErrConflict):
		writeJSONError(w, 409, "Another staff member changed this event. Reload it before saving your changes.")
	case errors.Is(err, events.ErrCancelled):
		writeJSONError(w, 409, "This event has been cancelled and cannot be edited.")
	case errors.Is(err, events.ErrForbidden):
		writeJSONError(w, 403, "Access restricted. Staff access is required.")
	default:
		writeJSONError(w, 503, "Events are temporarily unavailable. Try again.")
	}
}

func decodeEventBody(w http.ResponseWriter, r *http.Request, value any) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		writeJSONError(w, 415, "Send event fields as JSON.")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		writeJSONError(w, 400, "Send only editable event fields in a valid JSON object.")
		return false
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		writeJSONError(w, 400, "Send one event object.")
		return false
	}
	return true
}

func registerEventRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore, store eventStore) {
	guard := func(next func(http.ResponseWriter, *http.Request, auth.Identity)) http.HandlerFunc {
		return withStaffTimeout(authentication, profiles, 24*time.Second, func(w http.ResponseWriter, r *http.Request, actor auth.Identity, _ profile.Record) {
			if store == nil {
				writeEventError(w, auth.ErrUnavailable)
				return
			}
			next(w, r, actor)
		})
	}
	mux.HandleFunc("GET /staff/events", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		page, err := events.ParsePage(r.URL.Query().Get("page"))
		if err != nil {
			writeEventError(w, err)
			return
		}
		result, err := store.List(r.Context(), r.URL.Query().Get("filter"), page)
		if err != nil {
			writeEventError(w, err)
			return
		}
		writeJSON(w, result)
	}))
	mux.HandleFunc("GET /staff/events/{id}", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		e, err := store.Get(r.Context(), r.PathValue("id"))
		if err != nil {
			writeEventError(w, err)
			return
		}
		writeJSON(w, e)
	}))
	mux.HandleFunc("GET /staff/events/{id}/history", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		var before int64
		var err error
		if raw := r.URL.Query().Get("before"); raw != "" {
			before, err = strconv.ParseInt(raw, 10, 64)
		}
		if err != nil || before < 0 {
			writeEventError(w, events.ErrInvalid)
			return
		}
		h, err := store.History(r.Context(), r.PathValue("id"), before)
		if err != nil {
			writeEventError(w, err)
			return
		}
		writeJSON(w, h)
	}))
	mux.HandleFunc("PUT /staff/events/{id}", guard(func(w http.ResponseWriter, r *http.Request, actor auth.Identity) {
		var input *events.Input
		if !decodeEventBody(w, r, &input) {
			return
		}
		if input == nil {
			writeEventError(w, events.ErrInvalid)
			return
		}
		if err := input.Validate(); err != nil {
			writeEventError(w, err)
			return
		}
		e, err := store.Save(r.Context(), actor.ID, r.PathValue("id"), *input)
		if err != nil {
			writeEventError(w, err)
			return
		}
		writeJSON(w, e)
	}))
	mux.HandleFunc("POST /staff/events/{id}/cancel", guard(func(w http.ResponseWriter, r *http.Request, actor auth.Identity) {
		var input *struct {
			Version int `json:"version"`
		}
		if !decodeEventBody(w, r, &input) {
			return
		}
		if input == nil || input.Version < 1 {
			writeEventError(w, events.ErrInvalid)
			return
		}
		e, err := store.Cancel(r.Context(), actor.ID, r.PathValue("id"), input.Version)
		if err != nil {
			writeEventError(w, err)
			return
		}
		writeJSON(w, e)
	}))
	mux.HandleFunc("POST /staff/events/{id}/sync", guard(func(w http.ResponseWriter, r *http.Request, actor auth.Identity) {
		e, err := store.Sync(r.Context(), actor.ID, r.PathValue("id"))
		if err != nil {
			writeEventError(w, err)
			return
		}
		writeJSON(w, e)
	}))
	for _, path := range []string{"/staff/events", "/staff/events/{id}", "/staff/events/{id}/history", "/staff/events/{id}/cancel", "/staff/events/{id}/sync"} {
		mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	}
}
