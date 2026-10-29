package events

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const calendarScope = "https://www.googleapis.com/auth/calendar.events"

type GoogleCalendar struct {
	client  *http.Client
	baseURL string
}

// NewGoogle uses server-side Application Default Credentials. On Cloud Run use
// its attached service account; a mounted service-account JSON file is supported
// through GOOGLE_APPLICATION_CREDENTIALS. Personal OAuth credentials are refused.
func NewGoogle() (*GoogleCalendar, error) {
	transport := &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	ctx := context.WithValue(context.Background(), oauth2.HTTPClient, transport)
	credentials, err := google.FindDefaultCredentials(ctx, calendarScope)
	if err != nil {
		return nil, errors.New("Google Calendar credentials are unavailable; configure the server service account")
	}
	if len(credentials.JSON) > 0 {
		var config struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(credentials.JSON, &config) != nil || config.Type != "service_account" {
			return nil, errors.New("Google Calendar requires a dedicated service account")
		}
	}
	client := oauth2.NewClient(ctx, credentials.TokenSource)
	client.Timeout = 8 * time.Second
	client.CheckRedirect = transport.CheckRedirect
	return &GoogleCalendar{client: client, baseURL: "https://www.googleapis.com/calendar/v3"}, nil
}

type googleEvent struct {
	ID                 string                       `json:"id,omitempty"`
	Status             string                       `json:"status,omitempty"`
	Summary            string                       `json:"summary"`
	Location           string                       `json:"location"`
	Description        string                       `json:"description"`
	Start              googleTime                   `json:"start"`
	End                googleTime                   `json:"end"`
	HTMLLink           string                       `json:"htmlLink,omitempty"`
	ExtendedProperties map[string]map[string]string `json:"extendedProperties,omitempty"`
}
type googleTime struct {
	DateTime string `json:"dateTime"`
	TimeZone string `json:"timeZone"`
}

func payload(e Event) googleEvent {
	return googleEvent{
		ID: e.CalendarEventID, Status: "confirmed", Summary: e.Title,
		Location: e.Location, Description: html.EscapeString(e.Description),
		Start:              googleTime{e.StartsAt.In(newYork).Format(time.RFC3339), Timezone},
		End:                googleTime{e.EndsAt.In(newYork).Format(time.RFC3339), Timezone},
		ExtendedProperties: map[string]map[string]string{"private": {"cscEventId": e.ID}},
	}
}

func (g *GoogleCalendar) request(ctx context.Context, method, path string, body any) (googleEvent, int, error) {
	var encoded []byte
	var err error
	if body != nil {
		encoded, err = json.Marshal(body)
		if err != nil {
			return googleEvent{}, 0, ErrCalendar
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, g.baseURL+path, bytes.NewReader(encoded))
	if err != nil {
		return googleEvent{}, 0, ErrCalendar
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	response, err := g.client.Do(req)
	if err != nil {
		return googleEvent{}, 0, ErrCalendar
	}
	defer response.Body.Close()
	var result googleEvent
	if response.StatusCode >= 200 && response.StatusCode < 300 && response.StatusCode != http.StatusNoContent {
		if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&result); err != nil {
			return googleEvent{}, response.StatusCode, ErrCalendar
		}
	}
	return result, response.StatusCode, nil
}

func calendarPath(e Event) string {
	return "/calendars/" + url.PathEscape(e.CalendarID) + "/events"
}

func safeCalendarURL(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && u.Scheme == "https" && u.User == nil && u.Port() == "" &&
		(u.Hostname() == "calendar.google.com" || (u.Hostname() == "www.google.com" && strings.HasPrefix(u.Path, "/calendar/")))
}

// Called only by saving or an explicit staff sync. There are no polls, watches,
// automatic retries, guest invitations, or import from Google to the CRM.
func (g *GoogleCalendar) Upsert(ctx context.Context, e Event) (string, error) {
	collection := calendarPath(e)
	path := collection + "/" + url.PathEscape(e.CalendarEventID)
	existing, status, err := g.request(ctx, http.MethodGet, path, nil)
	if err != nil {
		return "", err
	}
	if status == http.StatusGone || (status == http.StatusOK && existing.Status == "cancelled") {
		return "", ErrGone
	}
	var result googleEvent
	switch status {
	case http.StatusOK:
		result, status, err = g.request(ctx, http.MethodPut, path+"?sendUpdates=none", payload(e))
	case http.StatusNotFound:
		result, status, err = g.request(ctx, http.MethodPost, collection+"?sendUpdates=none", payload(e))
		if err == nil && status == http.StatusConflict {
			// The earlier insert may have succeeded but lost its response. Read it
			// before updating; a tombstone requires a newly persisted identity.
			existing, status, err = g.request(ctx, http.MethodGet, path, nil)
			if err == nil && (status == http.StatusGone || (status == http.StatusOK && existing.Status == "cancelled")) {
				return "", ErrGone
			}
			// An unresolved conflict followed by 404 is ambiguous, not proof of
			// deletion. Keep the same ID for a later manual retry to avoid duplicates.
			if err == nil && status == http.StatusOK {
				result, status, err = g.request(ctx, http.MethodPut, path+"?sendUpdates=none", payload(e))
			}
		}
	default:
		return "", ErrCalendar
	}
	if err != nil {
		return "", err
	}
	if status == http.StatusGone {
		return "", ErrGone
	}
	if (status != http.StatusOK && status != http.StatusCreated) || result.ID != e.CalendarEventID || !safeCalendarURL(result.HTMLLink) {
		return "", ErrCalendar
	}
	return result.HTMLLink, nil
}

func (g *GoogleCalendar) Remove(ctx context.Context, e Event) error {
	_, status, err := g.request(ctx, http.MethodDelete, calendarPath(e)+"/"+url.PathEscape(e.CalendarEventID)+"?sendUpdates=none", nil)
	if err != nil {
		return err
	}
	// Already absent/deleted is the desired state, including an event whose
	// original insertion timed out or never reached Google.
	if status == http.StatusNotFound {
		// Google also returns 404 when the calendar is inaccessible. Confirm
		// calendar access before calling a missing event successfully removed.
		_, listStatus, listErr := g.request(ctx, http.MethodGet, calendarPath(e)+"?maxResults=1&fields=kind", nil)
		if listErr != nil || listStatus != http.StatusOK {
			return ErrCalendar
		}
		return nil
	}
	if status == http.StatusNoContent || status == http.StatusGone {
		return nil
	}
	return ErrCalendar
}
