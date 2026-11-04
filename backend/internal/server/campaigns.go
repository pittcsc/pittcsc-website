package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/campaigns"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
	"html"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func campaignError(w http.ResponseWriter, e error) {
	status, message := 503, "Email tools are temporarily unavailable. Try again."
	switch {
	case errors.Is(e, campaigns.ErrInvalid):
		status, message = 400, "Check the fields, column mappings, URLs, and selected date/time. Repeated or skipped daylight-saving times are not allowed."
	case errors.Is(e, campaigns.ErrConflict):
		status, message = 409, "This record changed or its state no longer permits this action. Your edits are still here; reload and reconcile before saving."
	case errors.Is(e, campaigns.ErrNotFound):
		status, message = 404, "That email record or link was not found."
	case errors.Is(e, campaigns.ErrDisabled):
		status, message = 409, "Email delivery is disabled. Complete the SES setup or enable local test delivery."
	case errors.Is(e, campaigns.ErrBlocked):
		status, message = 403, "This action is blocked by subscription, delivery, archival, or staff-access restrictions."
	}
	writeJSONError(w, status, message)
}
func campaignBody(w http.ResponseWriter, r *http.Request, v any) bool {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		writeJSONError(w, 415, "Send JSON.")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 3*1024*1024)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(v) != nil || d.Decode(new(any)) != io.EOF {
		writeJSONError(w, 400, "Send one valid JSON object with the expected fields.")
		return false
	}
	return true
}
func registerCampaignRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore, s *campaigns.Store) {
	guard := func(f func(http.ResponseWriter, *http.Request, auth.Identity)) http.HandlerFunc {
		return withStaffTimeout(authentication, profiles, 25*time.Second, func(w http.ResponseWriter, r *http.Request, a auth.Identity, _ profile.Record) {
			if s == nil {
				campaignError(w, campaigns.ErrDisabled)
				return
			}
			f(w, r, a)
		})
	}
	respond := func(w http.ResponseWriter, v any, e error) {
		if e != nil {
			campaignError(w, e)
		} else {
			writeJSON(w, v)
		}
	}
	mux.HandleFunc("GET /staff/email/status", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		writeJSON(w, map[string]any{"enabled": s.Transport != nil, "publicURL": s.PublicURL, "timezone": "America/New_York"})
	}))
	mux.HandleFunc("GET /staff/email/contacts", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		v, e := s.Contacts(r.Context())
		respond(w, v, e)
	}))
	mux.HandleFunc("PUT /staff/email/contacts/{id}", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in campaigns.ContactInput
		if !campaignBody(w, r, &in) {
			return
		}
		v, e := s.SaveContact(r.Context(), a.ID, r.PathValue("id"), in)
		respond(w, v, e)
	}))
	mux.HandleFunc("POST /staff/email/tags", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in struct {
			IDs    []string `json:"ids"`
			Tags   []string `json:"tags"`
			Remove bool     `json:"remove"`
		}
		if !campaignBody(w, r, &in) {
			return
		}
		e := s.BulkTags(r.Context(), a.ID, in.IDs, in.Tags, in.Remove)
		respond(w, map[string]bool{"saved": e == nil}, e)
	}))
	mux.HandleFunc("POST /staff/email/import/preview", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in campaigns.ImportInput
		if !campaignBody(w, r, &in) {
			return
		}
		v, e := s.PreviewImport(r.Context(), a.ID, in)
		respond(w, v, e)
	}))
	mux.HandleFunc("POST /staff/email/import/{id}/commit", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in struct {
			Overwrite bool  `json:"overwrite"`
			Skip      []int `json:"skip"`
		}
		if !campaignBody(w, r, &in) {
			return
		}
		v, e := s.CommitImport(r.Context(), a.ID, r.PathValue("id"), in.Overwrite, in.Skip)
		respond(w, v, e)
	}))
	mux.HandleFunc("GET /staff/email/campaigns", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		v, e := s.Drafts(r.Context())
		respond(w, v, e)
	}))
	mux.HandleFunc("GET /staff/email/campaigns/{id}", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		v, e := s.Draft(r.Context(), r.PathValue("id"))
		respond(w, v, e)
	}))
	mux.HandleFunc("PUT /staff/email/campaigns/{id}", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in campaigns.DraftInput
		if !campaignBody(w, r, &in) {
			return
		}
		v, e := s.SaveDraft(r.Context(), a.ID, r.PathValue("id"), in)
		respond(w, v, e)
	}))
	mux.HandleFunc("POST /staff/email/campaigns/{id}/action", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in struct {
			Action  string `json:"action"`
			Version int    `json:"version"`
			At      string `json:"at"`
		}
		if !campaignBody(w, r, &in) {
			return
		}
		v, e := s.Action(r.Context(), a.ID, r.PathValue("id"), in.Action, in.Version, in.At)
		respond(w, v, e)
	}))
	mux.HandleFunc("POST /staff/email/campaigns/{id}/test", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in struct {
			Emails    []string `json:"emails"`
			RequestID string   `json:"requestId"`
			Version   int      `json:"version"`
		}
		if !campaignBody(w, r, &in) {
			return
		}
		e := s.Tests(r.Context(), a.ID, r.PathValue("id"), in.RequestID, in.Version, in.Emails)
		respond(w, map[string]bool{"queued": e == nil}, e)
	}))
	mux.HandleFunc("POST /staff/email/campaigns/{id}/resolve", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in struct {
			RecipientID string `json:"recipientId"`
			Action      string `json:"action"`
		}
		if !campaignBody(w, r, &in) {
			return
		}
		e := s.Resolve(r.Context(), a.ID, r.PathValue("id"), in.RecipientID, in.Action)
		respond(w, map[string]bool{"saved": e == nil}, e)
	}))
	mux.HandleFunc("GET /staff/email/campaigns/{id}/report", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		v, e := s.Report(r.Context(), r.PathValue("id"))
		respond(w, v, e)
	}))
	mux.HandleFunc("POST /staff/email/preview", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		var in campaigns.DraftInput
		if !campaignBody(w, r, &in) {
			return
		}
		if e := in.Validate(); e != nil {
			campaignError(w, e)
			return
		}
		h, _ := campaigns.Render(campaigns.Draft{Blocks: in.Blocks, Preheader: in.Preheader}, "Alex", "#unsubscribe")
		writeJSON(w, map[string]string{"html": h})
	}))
	for _, kind := range []string{"templates", "audiences"} {
		mux.HandleFunc("GET /staff/email/"+kind, guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
			v, e := s.Library(r.Context(), kind)
			respond(w, v, e)
		}))
		mux.HandleFunc("POST /staff/email/"+kind, guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
			var in campaigns.Saved
			if !campaignBody(w, r, &in) {
				return
			}
			e := s.SaveLibrary(r.Context(), a.ID, kind, in)
			respond(w, map[string]bool{"saved": e == nil}, e)
		}))
	}
	mux.HandleFunc("GET /staff/email/assets", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		v, e := s.Assets(r.Context())
		respond(w, v, e)
	}))
	mux.HandleFunc("POST /staff/email/assets", guard(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)
		b, e := io.ReadAll(r.Body)
		if e != nil {
			writeJSONError(w, 413, "Choose an image up to 5 MB.")
			return
		}
		v, e := s.Upload(r.Context(), a.ID, r.URL.Query().Get("name"), b)
		respond(w, v, e)
	}))
	mux.HandleFunc("GET /staff/email/export/{kind}", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		var b bytes.Buffer
		var e error
		switch r.PathValue("kind") {
		case "contacts":
			var a *campaigns.Audience
			if raw := r.URL.Query().Get("audience"); raw != "" {
				a = &campaigns.Audience{}
				if json.Unmarshal([]byte(raw), a) != nil || a.Validate() != nil {
					campaignError(w, campaigns.ErrInvalid)
					return
				}
			}
			e = s.ExportContacts(r.Context(), &b, a, r.URL.Query().Get("q"), r.URL.Query().Get("archived") == "true")
		case "summary", "recipients", "clicks":
			id := r.URL.Query().Get("id")
			v, err := s.Report(r.Context(), id)
			if err != nil {
				campaignError(w, err)
				return
			}
			rows := [][]string{}
			switch r.PathValue("kind") {
			case "summary":
				rows = append(rows, []string{"metric", "count"})
				for _, k := range []string{"recipients", "accepted", "delivered", "bounced", "complaints", "unsubscribed", "clicks", "pending", "uncertain", "failed", "skipped"} {
					rows = append(rows, []string{k, strconv.Itoa(v.Counts[k])})
				}
			case "clicks":
				rows = append(rows, []string{"url", "recorded_clicks", "unique_recipients", "likely_automated"})
				for _, c := range v.Clicks {
					rows = append(rows, []string{c.URL, strconv.Itoa(c.Total), strconv.Itoa(c.Unique), strconv.Itoa(c.Automated)})
				}
			case "recipients":
				rows = append(rows, []string{"first_name", "last_name", "email", "dispatch_status", "delivered", "bounced", "complaint", "unsubscribed", "reason"})
				for _, v := range v.Recipients {
					rows = append(rows, []string{v.FirstName, v.LastName, v.Email, v.Status, strconv.FormatBool(v.Delivery), strconv.FormatBool(v.Bounced), strconv.FormatBool(v.Complaint), strconv.FormatBool(v.Unsubscribe), v.Reason})
				}
			}
			e = campaigns.WriteCSV(&b, rows)
		default:
			e = campaigns.ErrInvalid
		}
		if e != nil {
			campaignError(w, e)
			return
		}
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="csc-email-`+r.PathValue("kind")+`.csv"`)
		_, _ = w.Write(b.Bytes())
	}))
	member := func(f func(http.ResponseWriter, *http.Request, auth.Identity)) http.HandlerFunc {
		return withProfile(authentication, profiles, 5*time.Second, func(w http.ResponseWriter, r *http.Request, a auth.Identity, _ profile.Record) {
			if s == nil {
				campaignError(w, campaigns.ErrDisabled)
				return
			}
			f(w, r, a)
		})
	}
	mux.HandleFunc("GET /profile/email-subscription", member(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		v, e := s.Subscription(r.Context(), a.ID)
		respond(w, v, e)
	}))
	mux.HandleFunc("PUT /profile/email-subscription", member(func(w http.ResponseWriter, r *http.Request, a auth.Identity) {
		var in struct {
			Subscribed *bool `json:"subscribed"`
		}
		if !campaignBody(w, r, &in) {
			return
		}
		if in.Subscribed == nil {
			campaignError(w, campaigns.ErrInvalid)
			return
		}
		v, e := s.SetSubscription(r.Context(), a.ID, *in.Subscribed)
		respond(w, v, e)
	}))
	registerPublicEmailRoutes(mux, s)
	for _, path := range []string{"/staff/email/{rest...}", "/profile/email-subscription"} {
		mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	}
}
func emailPage(w http.ResponseWriter, title, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")
	fmt.Fprintf(w, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s · Pitt CSC</title></head><body style="font-family:system-ui;background:#eef2f7;color:#071b35;padding:30px"><main style="max-width:560px;margin:60px auto;background:white;padding:32px;border-radius:16px"><h1>%s</h1>%s</main></body></html>`, html.EscapeString(title), html.EscapeString(title), body)
}
func registerPublicEmailRoutes(mux *http.ServeMux, s *campaigns.Store) {
	available := func(w http.ResponseWriter) bool {
		if s == nil {
			campaignError(w, campaigns.ErrDisabled)
			return false
		}
		return true
	}
	mux.HandleFunc("GET /email/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		media, b, e := s.Asset(r.Context(), r.PathValue("id"))
		if e != nil {
			campaignError(w, e)
			return
		}
		w.Header().Set("Content-Type", media)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("GET /email/preferences", func(w http.ResponseWriter, r *http.Request) {
		emailPage(w, "CSC email preferences", "<p>Use the unsubscribe link in a CSC campaign to manage your subscription. Test recipients who are not subscribed have no subscription to change.</p>")
	})
	mux.HandleFunc("GET /email/preferences/{token}", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		c, e := s.ByToken(r.Context(), r.PathValue("token"))
		if e != nil {
			campaignError(w, e)
			return
		}
		body := `<p>Manage your CSC newsletters and event announcements.</p>`
		if c.Subscribed {
			body += `<form method="post"><button type="submit" name="action" value="unsubscribe">Unsubscribe from all CSC campaigns</button></form>`
		} else {
			body += `<p>You are unsubscribed.</p><form method="post"><button type="submit" name="action" value="resubscribe">Email me a resubscription confirmation</button></form>`
		}
		if c.Blocked != "" {
			body += `<p>Campaign delivery is also blocked following a bounce or complaint. Changing subscription preferences does not remove this block.</p>`
		}
		emailPage(w, "CSC email preferences", body)
	})
	mux.HandleFunc("POST /email/preferences/{token}", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 2048)
		if r.ParseForm() != nil {
			campaignError(w, campaigns.ErrInvalid)
			return
		}
		var e error
		message := "You are unsubscribed from CSC campaigns."
		if r.PostForm.Get("action") == "resubscribe" {
			e = s.RequestResubscribe(r.Context(), r.PathValue("token"))
			message = "Check your inbox for a confirmation link. If you requested one recently, use that message or try again in ten minutes."
		} else if r.PostForm.Get("action") == "unsubscribe" || r.PostForm.Get("List-Unsubscribe") == "One-Click" {
			e = s.Unsubscribe(r.Context(), r.PathValue("token"), r.URL.Query().Get("campaign"))
		} else {
			e = campaigns.ErrInvalid
		}
		if e != nil {
			campaignError(w, e)
			return
		}
		emailPage(w, "CSC email preferences", "<p>"+html.EscapeString(message)+"</p>")
	})
	mux.HandleFunc("GET /email/verify/{token}", func(w http.ResponseWriter, r *http.Request) {
		emailPage(w, "Confirm your subscription", `<p>Receive CSC newsletters and event announcements again.</p><form method="post"><button type="submit">Confirm subscription</button></form>`)
	})
	mux.HandleFunc("POST /email/verify/{token}", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		if e := s.ConfirmResubscribe(r.Context(), r.PathValue("token")); e != nil {
			campaignError(w, e)
			return
		}
		emailPage(w, "Subscription confirmed", "<p>You are subscribed to CSC announcements.</p>")
	})
	mux.HandleFunc("POST /email/ses-events", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 512*1024)
		var m campaigns.SNSMessage
		d := json.NewDecoder(r.Body)
		if d.Decode(&m) != nil || d.Decode(new(any)) != io.EOF {
			writeJSONError(w, 400, "Invalid event.")
			return
		}
		if e := m.Verify(r.Context(), s.TopicARN); e != nil {
			writeJSONError(w, 403, "Unverified event.")
			return
		}
		if m.Type == "SubscriptionConfirmation" {
			if e := s.ConfirmSNS(r.Context(), m); e != nil {
				campaignError(w, e)
				return
			}
			w.WriteHeader(204)
			return
		}
		if m.Type != "Notification" {
			writeJSON(w, map[string]string{"status": "Confirm the SNS subscription in AWS using the pending subscription token."})
			return
		}
		if e := s.Ingest(r.Context(), m); e != nil {
			campaignError(w, e)
			return
		}
		w.WriteHeader(204)
	})
}
