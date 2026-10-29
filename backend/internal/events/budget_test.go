package events

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestFormatCents(t *testing.T) {
	for cents, want := range map[int64]string{0: "$0.00", 5: "$0.05", 1250: "$12.50", 123456: "$1,234.56", MaxAmountCents: "$100,000.00", 2_500_000_000: "$25,000,000.00"} {
		if got := FormatCents(cents); got != want {
			t.Fatalf("FormatCents(%d) = %s, want %s", cents, got, want)
		}
	}
}

func receiptImage(t *testing.T, kind string, w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(img, img.Bounds(), image.White, image.Point{}, draw.Src)
	for x := range w {
		img.Set(x, h/2, color.Black)
	}
	var b bytes.Buffer
	var err error
	if kind == "image/png" {
		err = png.Encode(&b, img)
	} else {
		err = jpeg.Encode(&b, img, nil)
	}
	if err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func TestRenderBudgetPDF(t *testing.T) {
	start := time.Date(2027, 1, 15, 23, 0, 0, 0, time.UTC)
	p := BudgetPackage{Event: Event{Title: "Résumé Workshop", Location: "Sennott Square", StartsAt: start, EndsAt: start.Add(time.Hour)}}
	// Enough rows to span several pages, plus names the core fonts can't fully encode.
	for i := range 90 {
		p.Attendees = append(p.Attendees, BudgetAttendee{Name: "Attendee " + strconv.Itoa(i+1), Email: "abc" + strconv.Itoa(i) + "@pitt.edu"})
	}
	p.Attendees[0].Name = strings.Repeat("Very Long Name ", 20)
	p.Attendees[1].Name = "李小龙 Zoë"
	p.Receipts = []BudgetReceipt{
		{AmountCents: 1250, MediaType: "image/jpeg", Bytes: receiptImage(t, "image/jpeg", 1800, 2400), UploadedByName: "Staff A"},
		{AmountCents: 99, MediaType: "image/png", Bytes: receiptImage(t, "image/png", 2400, 400), UploadedByName: "Staff B"},
		{AmountCents: 0, MediaType: "image/jpeg", Bytes: receiptImage(t, "image/jpeg", 40, 4000), UploadedByName: "Staff C"},
	}
	out, err := RenderBudgetPDF(p)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(out, []byte("%PDF-")) {
		t.Fatal("not a PDF")
	}
	if n := bytes.Count(out, []byte("/Subtype /Image")); n != 3 {
		t.Fatalf("embedded %d receipt images, want 3", n)
	}
	if n := bytes.Count(out, []byte("/Type /Page\n")); n < 4 {
		t.Fatalf("expected the roster and receipts to span pages, got %d", n)
	}

	empty, err := RenderBudgetPDF(BudgetPackage{Event: p.Event})
	if err != nil || !bytes.HasPrefix(empty, []byte("%PDF-")) {
		t.Fatal("event without attendees or receipts must still export")
	}
	p.Receipts = []BudgetReceipt{{MediaType: "image/jpeg", Bytes: []byte("not an image")}}
	if _, err := RenderBudgetPDF(p); err == nil {
		t.Fatal("corrupt receipt image silently dropped")
	}
}
