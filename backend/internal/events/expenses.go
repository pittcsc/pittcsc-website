package events

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	MaxReceipts      = 25
	MaxAmountCents   = 10_000_000
	ReceiptByteLimit = 10 * 1024 * 1024
)

var (
	ErrReceiptLimit   = errors.New("receipt limit reached")
	ErrReceiptChanged = errors.New("receipt amount changed")
)

type ReceiptInfo struct {
	ID             string    `json:"id"`
	AmountCents    int64     `json:"amountCents"`
	Size           int       `json:"size"`
	UploadedByName string    `json:"uploadedByName"`
	CreatedAt      time.Time `json:"createdAt"`
}

// Expenses is staff-only. The total is derived from receipts and is never
// stored or accepted from the client.
type Expenses struct {
	TotalCents int64         `json:"totalCents"`
	Receipts   []ReceiptInfo `json:"receipts"`
}

type Receipt struct {
	MediaType string
	Bytes     []byte
}

func (s Store) Expenses(ctx context.Context, eventID string) (Expenses, error) {
	if _, err := s.Get(ctx, eventID); err != nil {
		return Expenses{}, err
	}
	rows, err := s.DB.Query(ctx, `select r.id::text, r.amount_cents, octet_length(r.bytes),
		coalesce(nullif(concat_ws(' ', coalesce(p.preferred_name, p.first_name), p.last_name), ''), 'Staff member'),
		r.created_at from csc.event_receipts r left join csc.profiles p on p.auth_user_id = r.uploaded_by
		where r.event_id = $1::uuid order by r.created_at, r.id`, eventID)
	if err != nil {
		return Expenses{}, err
	}
	defer rows.Close()
	result := Expenses{Receipts: []ReceiptInfo{}}
	for rows.Next() {
		var r ReceiptInfo
		if err := rows.Scan(&r.ID, &r.AmountCents, &r.Size, &r.UploadedByName, &r.CreatedAt); err != nil {
			return Expenses{}, err
		}
		r.CreatedAt = r.CreatedAt.UTC()
		result.TotalCents += r.AmountCents
		result.Receipts = append(result.Receipts, r)
	}
	return result, rows.Err()
}

// beginReceipt rechecks staff access inside the transaction and locks the event
// row so concurrent uploads cannot exceed the receipt limit. Cancelled events
// stay editable: money may already have been spent.
func (s Store) beginReceipt(ctx context.Context, actor, eventID string) (pgx.Tx, error) {
	if !uuidPattern.MatchString(eventID) {
		return nil, ErrNotFound
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if err := authorize(ctx, tx, actor); err != nil {
		tx.Rollback(context.Background())
		return nil, err
	}
	var id string
	err = tx.QueryRow(ctx, `select id::text from csc.events where id = $1::uuid for update`, eventID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	if err != nil {
		tx.Rollback(context.Background())
		return nil, err
	}
	return tx, nil
}

// PutReceipt stores an already validated and re-encoded image with its amount.
// The receipt ID comes from the client so a retried upload cannot create a
// second copy; reusing an ID for a different event or amount is a conflict.
func (s Store) PutReceipt(ctx context.Context, actor, eventID, receiptID string, amountCents int64, mediaType string, data []byte) error {
	if !uuidPattern.MatchString(receiptID) {
		return ErrNotFound
	}
	if amountCents < 0 || amountCents > MaxAmountCents {
		return ErrInvalid
	}
	tx, err := s.beginReceipt(ctx, actor, eventID)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var existingEvent string
	var existingAmount int64
	err = tx.QueryRow(ctx, `select event_id::text, amount_cents from csc.event_receipts where id = $1::uuid`, receiptID).
		Scan(&existingEvent, &existingAmount)
	if err == nil {
		if existingEvent != eventID || existingAmount != amountCents {
			return ErrConflict
		}
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	var count int
	if err := tx.QueryRow(ctx, `select count(*) from csc.event_receipts where event_id = $1::uuid`, eventID).Scan(&count); err != nil {
		return err
	}
	if count >= MaxReceipts {
		return ErrReceiptLimit
	}
	_, err = tx.Exec(ctx, `insert into csc.event_receipts (id, event_id, amount_cents, media_type, bytes, uploaded_by)
		values ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)`, receiptID, eventID, amountCents, mediaType, data, actor)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s Store) Receipt(ctx context.Context, eventID, receiptID string) (Receipt, error) {
	if !uuidPattern.MatchString(eventID) || !uuidPattern.MatchString(receiptID) {
		return Receipt{}, ErrNotFound
	}
	var r Receipt
	err := s.DB.QueryRow(ctx, `select media_type, bytes from csc.event_receipts
		where id = $1::uuid and event_id = $2::uuid`, receiptID, eventID).Scan(&r.MediaType, &r.Bytes)
	if errors.Is(err, pgx.ErrNoRows) {
		return Receipt{}, ErrNotFound
	}
	return r, err
}

// UpdateReceiptAmount changes one receipt's amount only if it still has the
// amount the editor last saw. Retrying an update that already committed
// succeeds; a different concurrent edit returns ErrReceiptChanged.
func (s Store) UpdateReceiptAmount(ctx context.Context, actor, eventID, receiptID string, previous, amountCents int64) error {
	if !uuidPattern.MatchString(receiptID) {
		return ErrNotFound
	}
	if amountCents < 0 || amountCents > MaxAmountCents || previous < 0 || previous > MaxAmountCents {
		return ErrInvalid
	}
	tx, err := s.beginReceipt(ctx, actor, eventID)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var current int64
	err = tx.QueryRow(ctx, `select amount_cents from csc.event_receipts
		where id = $1::uuid and event_id = $2::uuid for update`, receiptID, eventID).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if current == amountCents {
		return nil
	}
	if current != previous {
		return ErrReceiptChanged
	}
	if _, err := tx.Exec(ctx, `update csc.event_receipts set amount_cents = $3
		where id = $1::uuid and event_id = $2::uuid`, receiptID, eventID, amountCents); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// DeleteReceipt is idempotent: removing an already removed receipt succeeds.
func (s Store) DeleteReceipt(ctx context.Context, actor, eventID, receiptID string) error {
	if !uuidPattern.MatchString(receiptID) {
		return ErrNotFound
	}
	tx, err := s.beginReceipt(ctx, actor, eventID)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	_, err = tx.Exec(ctx, `delete from csc.event_receipts where id = $1::uuid and event_id = $2::uuid`, receiptID, eventID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
