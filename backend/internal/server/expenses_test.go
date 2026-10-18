package server

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/png"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/events"
)

func (s *eventsStub) Expenses(_ context.Context, id string) (events.Expenses, error) {
	s.expenseCalls++
	s.id = id
	return events.Expenses{Receipts: []events.ReceiptInfo{}}, s.err
}
func (s *eventsStub) PutReceipt(_ context.Context, actor, id, receipt string, amount int64, media string, data []byte) error {
	s.expenseCalls++
	s.actor, s.id, s.receipt, s.amount, s.receiptMedia, s.receiptBytes = actor, id, receipt, amount, media, data
	return s.err
}
func (s *eventsStub) Receipt(_ context.Context, id, receipt string) (events.Receipt, error) {
	s.expenseCalls++
	s.id, s.receipt = id, receipt
	return events.Receipt{MediaType: "image/png", Bytes: []byte("png")}, s.err
}
func (s *eventsStub) UpdateReceiptAmount(_ context.Context, actor, id, receipt string, previous, amount int64) error {
	s.expenseCalls++
	s.actor, s.id, s.receipt, s.previous, s.amount = actor, id, receipt, previous, amount
	return s.err
}
func (s *eventsStub) BudgetPackage(_ context.Context, id string) (events.BudgetPackage, error) {
	s.expenseCalls++
	s.id = id
	return events.BudgetPackage{
		Event:     events.Event{ID: id, Title: `Fall "Kickoff" / Pizza`, StartsAt: time.Date(2027, 1, 15, 23, 0, 0, 0, time.UTC)},
		Attendees: []events.BudgetAttendee{{Name: "Ada Lovelace", Email: "ada@pitt.edu"}},
	}, s.err
}
func (s *eventsStub) DeleteReceipt(_ context.Context, actor, id, receipt string) error {
	s.expenseCalls++
	s.actor, s.id, s.receipt = actor, id, receipt
	return s.err
}

func receiptRequest(roles []string, s *eventsStub, contentType string, body []byte) *httptest.ResponseRecorder {
	return receiptRequestAt(roles, s, "/staff/events/event-id/receipts/receipt-id?amountCents=1250", contentType, body)
}

func receiptRequestAt(roles []string, s *eventsStub, path, contentType string, body []byte) *httptest.ResponseRecorder {
	r := httptest.NewRequest("PUT", path, bytes.NewReader(body))
	r.Header.Set("Content-Type", contentType)
	r.Header.Set("Authorization", "Bearer valid")
	w := httptest.NewRecorder()
	NewHandler(nil, "http://localhost:8000", verifiedAuth(), &profilesStub{roles: roles}, nil, s).ServeHTTP(w, r)
	return w
}

func pngFixture(t *testing.T) []byte {
	var b bytes.Buffer
	if err := png.Encode(&b, image.NewRGBA(image.Rect(0, 0, 4, 4))); err != nil {
		t.Fatal(err)
	}
	return append(b.Bytes(), []byte("untrusted trailing metadata")...)
}

func TestExpensesAreStaffOnlyForEveryRoleMix(t *testing.T) {
	operations := []struct{ method, path, body string }{
		{"GET", "/staff/events/event-id/expenses", ""},
		{"GET", "/staff/events/event-id/receipts/receipt-id", ""},
		{"DELETE", "/staff/events/event-id/receipts/receipt-id", ""},
		{"PUT", "/staff/events/event-id/receipts/receipt-id/amount", `{"amountCents":1250,"previousAmountCents":1000}`},
		{"GET", "/staff/events/event-id/budget-package", ""},
	}
	for _, roles := range [][]string{{"member"}, {"member", "foundry"}, {"member", "alumni", "foundry"}, {"member", "staff"}, {"staff", "alumni"}} {
		staff := strings.Contains(strings.Join(roles, ","), "staff")
		for _, op := range operations {
			s := &eventsStub{}
			w := eventRequest(&profilesStub{roles: roles}, s, op.method, op.path, op.body, "valid")
			calls := 1
			if strings.HasSuffix(op.path, "/amount") {
				calls = 2 // the update, then the refreshed spending summary
			}
			if staff && (w.Code >= 300 || s.expenseCalls != calls || (op.method != "GET" && s.actor != "verified-owner")) {
				t.Fatalf("%v %s %s: got %d", roles, op.method, op.path, w.Code)
			}
			if !staff && (w.Code != 403 || s.expenseCalls != 0) {
				t.Fatalf("%v reached %s %s: %d", roles, op.method, op.path, w.Code)
			}
		}
		s := &eventsStub{}
		w := receiptRequest(roles, s, "image/png", pngFixture(t))
		if staff != (w.Code == 204 && s.expenseCalls == 1) || !staff && w.Code != 403 {
			t.Fatalf("%v receipt upload: %d", roles, w.Code)
		}
	}
	for _, token := range []string{"", "invalid"} {
		s := &eventsStub{}
		if w := eventRequest(&profilesStub{roles: []string{"staff"}}, s, "GET", "/staff/events/event-id/expenses", "", token); w.Code != 401 || s.expenseCalls != 0 {
			t.Fatal("unauthenticated expense read allowed")
		}
	}
}

func TestReceiptAmountValidation(t *testing.T) {
	for _, query := range []string{
		"", "?amountCents=", "?amountCents=-1", "?amountCents=10000001", "?amountCents=12.5",
		"?amountCents=1e3", "?amountCents=+5", "?amountCents=1&amountCents=2", "?amountCents=9999999999",
	} {
		s := &eventsStub{}
		w := receiptRequestAt([]string{"staff"}, s, "/staff/events/event-id/receipts/receipt-id"+query, "image/png", pngFixture(t))
		if w.Code != 400 || s.expenseCalls != 0 {
			t.Fatalf("invalid amount %q accepted: %d", query, w.Code)
		}
	}
	for _, amount := range []int64{0, events.MaxAmountCents} {
		s := &eventsStub{}
		w := receiptRequestAt([]string{"staff"}, s, fmt.Sprintf("/staff/events/event-id/receipts/receipt-id?amountCents=%d", amount), "image/png", pngFixture(t))
		if w.Code != 204 || s.amount != amount {
			t.Fatalf("amount %d rejected: %d", amount, w.Code)
		}
	}
	s := &eventsStub{err: events.ErrConflict}
	if w := receiptRequest([]string{"staff"}, s, "image/png", pngFixture(t)); w.Code != 409 {
		t.Fatal("receipt ID reuse with different details must conflict")
	}
	// The total is derived server-side; there is no route to set it directly.
	w := eventRequest(&profilesStub{roles: []string{"staff"}}, &eventsStub{}, "PUT", "/staff/events/event-id/expenses", `{"totalCents":1}`, "valid")
	if w.Code != 405 {
		t.Fatalf("total must not be writable: %d", w.Code)
	}
}

func TestReceiptUploadsAreReencodedAndValidated(t *testing.T) {
	s := &eventsStub{}
	w := receiptRequest([]string{"staff"}, s, "image/png", pngFixture(t))
	if w.Code != 204 || s.receipt != "receipt-id" || s.id != "event-id" || s.amount != 1250 || s.receiptMedia != "image/png" {
		t.Fatalf("receipt upload failed: %d", w.Code)
	}
	if bytes.Contains(s.receiptBytes, []byte("untrusted trailing metadata")) {
		t.Fatal("receipt kept trailing bytes")
	}
	for _, tc := range []struct {
		contentType string
		body        []byte
		code        int
	}{
		{"image/svg+xml", []byte("<svg/>"), 415},
		{"application/pdf", []byte("%PDF-1.4\n%%EOF"), 415},
		{"image/png", []byte("<svg/>"), 400},
		{"image/jpeg", nil, 400},
		{"image/jpeg", make([]byte, events.ReceiptByteLimit+1), 413},
	} {
		s := &eventsStub{}
		w := receiptRequest([]string{"staff"}, s, tc.contentType, tc.body)
		if w.Code != tc.code || s.expenseCalls != 0 {
			t.Fatalf("%s upload: got %d, want %d", tc.contentType, w.Code, tc.code)
		}
	}
	s = &eventsStub{err: events.ErrReceiptLimit}
	if w := receiptRequest([]string{"staff"}, s, "image/png", pngFixture(t)); w.Code != 409 {
		t.Fatal("receipt limit not reported")
	}
	s = &eventsStub{}
	w = eventRequest(&profilesStub{roles: []string{"staff"}}, s, "GET", "/staff/events/event-id/receipts/receipt-id", "", "valid")
	if w.Header().Get("Content-Type") != "image/png" || w.Header().Get("Cache-Control") != "no-store" || !strings.Contains(w.Header().Get("Content-Security-Policy"), "sandbox") {
		t.Fatal("receipt download must be private and sandboxed")
	}
}

func TestReceiptAmountEdits(t *testing.T) {
	path := "/staff/events/event-id/receipts/receipt-id/amount"
	for _, body := range []string{
		`{"amountCents":1250}`,
		`{"previousAmountCents":1000}`,
		`{"amountCents":-1,"previousAmountCents":1000}`,
		`{"amountCents":10000001,"previousAmountCents":1000}`,
		`{"amountCents":1250,"previousAmountCents":-5}`,
		`{"amountCents":12.5,"previousAmountCents":1000}`,
		`{"amountCents":1250,"previousAmountCents":1000,"eventId":"other"}`,
		`null`,
	} {
		s := &eventsStub{}
		w := eventRequest(&profilesStub{roles: []string{"staff"}}, s, "PUT", path, body, "valid")
		if w.Code != 400 || s.expenseCalls != 0 {
			t.Fatalf("invalid edit %s accepted: %d", body, w.Code)
		}
	}
	s := &eventsStub{}
	w := eventRequest(&profilesStub{roles: []string{"staff"}}, s, "PUT", path, `{"amountCents":0,"previousAmountCents":1000}`, "valid")
	if w.Code != 200 || s.amount != 0 || s.previous != 1000 || s.receipt != "receipt-id" || s.actor != "verified-owner" {
		t.Fatalf("edit not applied: %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"totalCents"`) {
		t.Fatal("edit must return the recomputed total")
	}
	s = &eventsStub{err: events.ErrReceiptChanged}
	w = eventRequest(&profilesStub{roles: []string{"staff"}}, s, "PUT", path, `{"amountCents":5,"previousAmountCents":1000}`, "valid")
	if w.Code != 409 || !strings.Contains(w.Body.String(), "Reload") {
		t.Fatal("concurrent amount edit must conflict")
	}
}

func TestBudgetPackageDownload(t *testing.T) {
	s := &eventsStub{}
	w := eventRequest(&profilesStub{roles: []string{"member", "staff"}}, s, "GET", "/staff/events/event-id/budget-package", "", "valid")
	if w.Code != 200 || w.Header().Get("Content-Type") != "application/pdf" || !strings.HasPrefix(w.Body.String(), "%PDF-") {
		t.Fatalf("budget package not returned: %d", w.Code)
	}
	if got := w.Header().Get("Content-Disposition"); got != `attachment; filename="budget-package-2027-01-15-fall-kickoff-pizza.pdf"` {
		t.Fatalf("unsafe or unexpected file name: %s", got)
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("budget package must not be cached")
	}
	s = &eventsStub{err: events.ErrNotFound}
	if w := eventRequest(&profilesStub{roles: []string{"staff"}}, s, "GET", "/staff/events/missing/budget-package", "", "valid"); w.Code != 404 {
		t.Fatal("missing event must 404")
	}
}
