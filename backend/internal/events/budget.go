package events

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/jackc/pgx/v5"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
)

type BudgetAttendee struct {
	Name  string
	Email string
}

type BudgetReceipt struct {
	AmountCents    int64
	MediaType      string
	Bytes          []byte
	UploadedByName string
	CreatedAt      time.Time
}

// BudgetPackage is the staff-only input to the exported PDF.
type BudgetPackage struct {
	Event     Event
	Attendees []BudgetAttendee
	Receipts  []BudgetReceipt
}

// BudgetPackage reads the event, every attendee in check-in order, and every
// receipt from one snapshot, so the roster and receipts describe the same moment.
func (s Store) BudgetPackage(ctx context.Context, eventID string) (BudgetPackage, error) {
	if !uuidPattern.MatchString(eventID) {
		return BudgetPackage{}, ErrNotFound
	}
	tx, err := s.DB.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return BudgetPackage{}, err
	}
	defer tx.Rollback(context.Background())
	result := BudgetPackage{Attendees: []BudgetAttendee{}, Receipts: []BudgetReceipt{}}
	result.Event, err = scanEvent(tx.QueryRow(ctx, `select `+columns+` from csc.events where id = $1::uuid`, eventID))
	if err != nil {
		return BudgetPackage{}, err
	}
	rows, err := tx.Query(ctx, `select coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), p.preferred_name, ''),
		coalesce(u.email, '') from csc.attendance a
		join csc.profiles p on p.auth_user_id = a.auth_user_id
		join auth.users u on u.id = a.auth_user_id
		where a.event_id = $1::uuid order by a.checked_in_at, a.auth_user_id`, eventID)
	if err != nil {
		return BudgetPackage{}, err
	}
	for rows.Next() {
		var a BudgetAttendee
		if err := rows.Scan(&a.Name, &a.Email); err != nil {
			rows.Close()
			return BudgetPackage{}, err
		}
		result.Attendees = append(result.Attendees, a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return BudgetPackage{}, err
	}
	rows, err = tx.Query(ctx, `select r.amount_cents, r.media_type, r.bytes,
		coalesce(nullif(concat_ws(' ', coalesce(p.preferred_name, p.first_name), p.last_name), ''), 'Staff member'),
		r.created_at from csc.event_receipts r left join csc.profiles p on p.auth_user_id = r.uploaded_by
		where r.event_id = $1::uuid order by r.created_at, r.id`, eventID)
	if err != nil {
		return BudgetPackage{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var r BudgetReceipt
		if err := rows.Scan(&r.AmountCents, &r.MediaType, &r.Bytes, &r.UploadedByName, &r.CreatedAt); err != nil {
			return BudgetPackage{}, err
		}
		result.Receipts = append(result.Receipts, r)
	}
	return result, rows.Err()
}

func FormatCents(cents int64) string {
	whole := strconv.FormatInt(cents/100, 10)
	for i := len(whole) - 3; i > 0; i -= 3 {
		whole = whole[:i] + "," + whole[i:]
	}
	return fmt.Sprintf("$%s.%02d", whole, cents%100)
}

// RenderBudgetPDF lays out a numbered attendee table followed by every receipt
// image. It embeds the Go fonts, which cover Latin, Greek, and Cyrillic text;
// characters outside them (for example, CJK names) render as empty boxes.
func RenderBudgetPDF(p BudgetPackage) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "Letter", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 15)
	pdf.SetTitle("Budget package", true)
	pdf.AddUTF8FontFromBytes("Go", "", goregular.TTF)
	pdf.AddUTF8FontFromBytes("Go", "B", gobold.TTF)
	pageW, pageH := pdf.GetPageSize()
	left, top, right, bottom := 15.0, 15.0, 15.0, 15.0
	width := pageW - left - right
	maxY := pageH - bottom

	var total int64
	for _, r := range p.Receipts {
		total += r.AmountCents
	}
	pdf.AddPage()
	pdf.SetFont("Go", "B", 16)
	pdf.MultiCell(width, 8, p.Event.Title, "", "L", false)
	pdf.SetFont("Go", "", 10)
	start := p.Event.StartsAt.In(newYork)
	pdf.CellFormat(width, 6, start.Format("Monday, January 2, 2006, 3:04 PM MST")+" · "+p.Event.Location, "", 1, "L", false, 0, "")
	pdf.CellFormat(width, 6, fmt.Sprintf("Attendees: %d · Receipts: %d · Total spent: %s",
		len(p.Attendees), len(p.Receipts), FormatCents(total)), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// The table repeats its header on each page and truncates rather than
	// overflowing a column.
	cols := []float64{14, (width - 14) * 0.45, (width - 14) * 0.55}
	const rowH = 7.0
	fit := func(text string, w float64) string {
		if pdf.GetStringWidth(text) <= w-3 {
			return text
		}
		runes := []rune(text)
		for len(runes) > 0 && pdf.GetStringWidth(string(runes)+"…") > w-3 {
			runes = runes[:len(runes)-1]
		}
		return string(runes) + "…"
	}
	header := func() {
		pdf.SetFont("Go", "B", 10)
		pdf.SetFillColor(230, 230, 230)
		for i, title := range []string{"#", "Name", "Email"} {
			pdf.CellFormat(cols[i], rowH, title, "1", 0, "L", true, 0, "")
		}
		pdf.Ln(-1)
		pdf.SetFont("Go", "", 10)
	}
	header()
	if len(p.Attendees) == 0 {
		pdf.CellFormat(width, rowH, "No one checked in to this event.", "1", 1, "L", false, 0, "")
	}
	for i, a := range p.Attendees {
		if pdf.GetY()+rowH > maxY {
			pdf.AddPage()
			header()
		}
		pdf.CellFormat(cols[0], rowH, strconv.Itoa(i+1), "1", 0, "L", false, 0, "")
		pdf.CellFormat(cols[1], rowH, fit(a.Name, cols[1]), "1", 0, "L", false, 0, "")
		pdf.CellFormat(cols[2], rowH, fit(a.Email, cols[2]), "1", 1, "L", false, 0, "")
	}

	pdf.Ln(8)
	const headingH, captionH = 10.0, 7.0
	heading := func() {
		pdf.SetFont("Go", "B", 13)
		pdf.CellFormat(width, headingH, "Receipts", "", 1, "L", false, 0, "")
		pdf.SetFont("Go", "", 10)
	}
	if len(p.Receipts) == 0 {
		if pdf.GetY()+headingH+6 > maxY {
			pdf.AddPage()
		}
		heading()
		pdf.CellFormat(width, 6, "No receipts uploaded.", "", 1, "L", false, 0, "")
	}
	for i, r := range p.Receipts {
		kind := "JPG"
		if r.MediaType == "image/png" {
			kind = "PNG"
		}
		name := "receipt-" + strconv.Itoa(i)
		info := pdf.RegisterImageOptionsReader(name, fpdf.ImageOptions{ImageType: kind}, bytes.NewReader(r.Bytes))
		if pdf.Err() || info == nil {
			return nil, errors.New("receipt image could not be added to the PDF")
		}
		// Scale to the content width, but never taller than a full page. The
		// section heading stays on the same page as the first receipt.
		extra := 0.0
		if i == 0 {
			extra = headingH
		}
		w, h := info.Extent()
		scale := min(width/w, (pageH-top-bottom-extra-captionH-2)/h)
		w, h = w*scale, h*scale
		if pdf.GetY()+extra+captionH+h > maxY {
			pdf.AddPage()
		}
		if i == 0 {
			heading()
		}
		pdf.CellFormat(width, captionH, fmt.Sprintf("Receipt %d · %s · uploaded by %s, %s", i+1,
			FormatCents(r.AmountCents), r.UploadedByName, r.CreatedAt.In(newYork).Format("Jan 2, 2006")), "", 1, "L", false, 0, "")
		pdf.ImageOptions(name, left, pdf.GetY(), w, h, false, fpdf.ImageOptions{ImageType: kind}, 0, "")
		pdf.SetY(pdf.GetY() + h + 6)
	}
	var out bytes.Buffer
	if err := pdf.Output(&out); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
