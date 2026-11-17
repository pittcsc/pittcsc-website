package campaigns

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

func tokenHash(raw string) string { h := sha256.Sum256([]byte(raw)); return hex.EncodeToString(h[:]) }
func (s *Store) RequestResubscribe(ctx context.Context, token string) error {
	if s.Transport == nil {
		return ErrDisabled
	}
	c, e := s.ByToken(ctx, token)
	if e != nil {
		return e
	}
	if c.Blocked != "" || c.Archived {
		return ErrBlocked
	}
	var raw [32]byte
	if _, e = rand.Read(raw[:]); e != nil {
		return e
	}
	code := hex.EncodeToString(raw[:])
	tag, e := s.DB.Exec(ctx, `insert into csc.email_verifications(contact_id,token_hash,expires_at) values($1::uuid,$2,now()+interval '30 minutes') on conflict(contact_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,requested_at=now() where csc.email_verifications.requested_at<now()-interval '10 minutes'`, c.ID, tokenHash(code))
	if e != nil {
		return e
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	link := strings.TrimRight(s.PublicURL, "/") + "/email/verify/" + code
	_, e = s.Transport.Send(ctx, Message{To: c.Email, Subject: "Confirm your CSC email subscription", HTML: `<p>You requested to receive CSC announcements again.</p><p><a href="` + link + `">Confirm subscription</a></p><p>If you did not request this, ignore this email. This link is valid for 30 minutes.</p>`, Text: "Confirm your CSC subscription: " + link + "\nThis link is valid for 30 minutes."})
	return e
}
func (s *Store) ConfirmResubscribe(ctx context.Context, code string) error {
	if len(code) != 64 {
		return ErrInvalid
	}
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var id string
	e = tx.QueryRow(ctx, `delete from csc.email_verifications where token_hash=$1 and expires_at>now() returning contact_id::text`, tokenHash(code)).Scan(&id)
	if e != nil {
		return dbError(e)
	}
	_, e = tx.Exec(ctx, `update csc.email_contacts set subscribed=true,version=version+1,updated_at=now() where id=$1::uuid`, id)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
