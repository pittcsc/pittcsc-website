package server

import (
	"context"
	"errors"
	"io"
	"mime"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/events"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

var (
	digits     = regexp.MustCompile(`^[0-9]{1,9}$`)
	newYork, _ = time.LoadLocation(events.Timezone)
)

type expenseStore interface {
	Expenses(context.Context, string) (events.Expenses, error)
	PutReceipt(ctx context.Context, actor, eventID, receiptID string, amountCents int64, mediaType string, data []byte) error
	Receipt(ctx context.Context, eventID, receiptID string) (events.Receipt, error)
	UpdateReceiptAmount(ctx context.Context, actor, eventID, receiptID string, previous, amountCents int64) error
	DeleteReceipt(ctx context.Context, actor, eventID, receiptID string) error
	BudgetPackage(ctx context.Context, eventID string) (events.BudgetPackage, error)
}

func writeExpenseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, events.ErrInvalid):
		writeJSONError(w, 400, "Enter a receipt amount from $0 to $100,000.")
	case errors.Is(err, events.ErrConflict):
		writeJSONError(w, 409, "This receipt was already saved with different details. Choose the file again to add it as a new receipt.")
	case errors.Is(err, events.ErrReceiptChanged):
		writeJSONError(w, 409, "Another staff member changed this receipt's amount. Reload spending before editing it.")
	case errors.Is(err, events.ErrReceiptLimit):
		writeJSONError(w, 409, "This event already has 25 receipts. Remove one before adding another.")
	case errors.Is(err, profile.ErrFileTooLarge):
		writeJSONError(w, 413, "Choose a receipt image up to 10 MB.")
	case errors.Is(err, profile.ErrInvalidFile):
		writeJSONError(w, 400, "Choose a JPEG, PNG, or WebP receipt image up to 4096 pixels per side.")
	default:
		writeEventError(w, err)
	}
}

func registerExpenseRoutes(mux *http.ServeMux, guard func(func(http.ResponseWriter, *http.Request, auth.Identity)) http.HandlerFunc, store eventStore) {
	expenses, ok := store.(expenseStore)
	if !ok {
		return
	}
	mux.HandleFunc("GET /staff/events/{id}/expenses", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		result, err := expenses.Expenses(r.Context(), r.PathValue("id"))
		if err != nil {
			writeExpenseError(w, err)
			return
		}
		writeJSON(w, result)
	}))
	mux.HandleFunc("GET /staff/events/{id}/receipts/{receipt}", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		receipt, err := expenses.Receipt(r.Context(), r.PathValue("id"), r.PathValue("receipt"))
		if err != nil {
			writeExpenseError(w, err)
			return
		}
		w.Header().Set("Content-Type", receipt.MediaType)
		w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		_, _ = w.Write(receipt.Bytes)
	}))
	mux.HandleFunc("PUT /staff/events/{id}/receipts/{receipt}", guard(func(w http.ResponseWriter, r *http.Request, actor auth.Identity) {
		raw := r.URL.Query()["amountCents"]
		var amount int64 = -1
		if len(raw) == 1 && digits.MatchString(raw[0]) {
			amount, _ = strconv.ParseInt(raw[0], 10, 64)
		}
		if amount < 0 || amount > events.MaxAmountCents {
			writeExpenseError(w, events.ErrInvalid)
			return
		}
		media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || (media != "application/octet-stream" && media != "image/jpeg" && media != "image/png" && media != "image/webp") {
			writeJSONError(w, http.StatusUnsupportedMediaType, "Choose a JPEG, PNG, or WebP receipt image.")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, events.ReceiptByteLimit)
		data, err := io.ReadAll(r.Body)
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				writeExpenseError(w, profile.ErrFileTooLarge)
			} else {
				writeJSONError(w, http.StatusBadRequest, "The upload could not be read. Try again.")
			}
			return
		}
		media, data, err = profile.ReencodeImage(data, events.ReceiptByteLimit)
		if err != nil {
			writeExpenseError(w, err)
			return
		}
		if err := expenses.PutReceipt(r.Context(), actor.ID, r.PathValue("id"), r.PathValue("receipt"), amount, media, data); err != nil {
			writeExpenseError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	mux.HandleFunc("PUT /staff/events/{id}/receipts/{receipt}/amount", guard(func(w http.ResponseWriter, r *http.Request, actor auth.Identity) {
		var input *struct {
			AmountCents         *int64 `json:"amountCents"`
			PreviousAmountCents *int64 `json:"previousAmountCents"`
		}
		if !decodeEventBody(w, r, &input) {
			return
		}
		if input == nil || input.AmountCents == nil || input.PreviousAmountCents == nil ||
			*input.AmountCents < 0 || *input.AmountCents > events.MaxAmountCents ||
			*input.PreviousAmountCents < 0 || *input.PreviousAmountCents > events.MaxAmountCents {
			writeExpenseError(w, events.ErrInvalid)
			return
		}
		id := r.PathValue("id")
		if err := expenses.UpdateReceiptAmount(r.Context(), actor.ID, id, r.PathValue("receipt"), *input.PreviousAmountCents, *input.AmountCents); err != nil {
			writeExpenseError(w, err)
			return
		}
		result, err := expenses.Expenses(r.Context(), id)
		if err != nil {
			writeExpenseError(w, err)
			return
		}
		writeJSON(w, result)
	}))
	mux.HandleFunc("GET /staff/events/{id}/budget-package", guard(func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		data, err := expenses.BudgetPackage(r.Context(), r.PathValue("id"))
		if err != nil {
			writeExpenseError(w, err)
			return
		}
		document, err := events.RenderBudgetPDF(data)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "The budget package could not be created. Try again, or remove a receipt image that won't open.")
			return
		}
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", `attachment; filename="budget-package-`+budgetFileName(data.Event)+`.pdf"`)
		w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
		_, _ = w.Write(document)
	}))
	mux.HandleFunc("DELETE /staff/events/{id}/receipts/{receipt}", guard(func(w http.ResponseWriter, r *http.Request, actor auth.Identity) {
		if err := expenses.DeleteReceipt(r.Context(), actor.ID, r.PathValue("id"), r.PathValue("receipt")); err != nil {
			writeExpenseError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	for _, path := range []string{"/staff/events/{id}/expenses", "/staff/events/{id}/receipts/{receipt}", "/staff/events/{id}/receipts/{receipt}/amount", "/staff/events/{id}/budget-package"} {
		mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	}
}

// budgetFileName is an ASCII slug of the event date and title, safe to place
// inside a quoted Content-Disposition filename.
func budgetFileName(e events.Event) string {
	var slug strings.Builder
	dash := false
	for _, r := range strings.ToLower(e.Title) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			slug.WriteRune(r)
			dash = false
		} else if !dash && slug.Len() > 0 {
			slug.WriteByte('-')
			dash = true
		}
		if slug.Len() >= 60 {
			break
		}
	}
	name := strings.Trim(slug.String(), "-")
	date := e.StartsAt.In(newYork).Format("2006-01-02")
	if name == "" {
		return date
	}
	return date + "-" + name
}
