package campaigns

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"strings"
	"time"
)

func (s *Store) freeze(ctx context.Context) error {
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	d, e := scanDraft(tx.QueryRow(ctx, draftSelect+` where d.status='scheduled' and d.scheduled_at<=now() and ($1::uuid[] is null or d.id=any($1::uuid[])) order by d.scheduled_at for update of d skip locked limit 1`, s.dispatchScope))
	if errors.Is(e, ErrNotFound) {
		return nil
	}
	if e != nil {
		return e
	}
	rows, e := tx.Query(ctx, contactSelect)
	if e != nil {
		return e
	}
	selected := []Contact{}
	for rows.Next() {
		c, e := scanContact(rows)
		if e != nil {
			rows.Close()
			return e
		}
		if d.Audience.Matches(c) {
			selected = append(selected, c)
		}
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	for _, c := range selected {
		_, e = tx.Exec(ctx, `insert into csc.email_recipients(campaign_id,contact_id,email,first_name,last_name) values($1::uuid,$2::uuid,$3,$4,$5) on conflict do nothing`, d.ID, c.ID, c.Email, c.FirstName, c.LastName)
		if e != nil {
			return e
		}
	}
	_, e = tx.Exec(ctx, `update csc.email_campaigns set status='sending',started_at=now(),version=version+1 where id=$1::uuid`, d.ID)
	if e != nil {
		return e
	}
	_, e = tx.Exec(ctx, `insert into csc.email_history(campaign_id,action,snapshot) values($1::uuid,'dispatch_started',$2)`, d.ID, jsonBytes(d))
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}

type work struct {
	ID, CampaignID, AttemptID, Email, FirstName, Token string
	Test                                               bool
	Draft                                              Draft
	Attempts                                           int
}

func (s *Store) claim(ctx context.Context) (work, error) {
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return work{}, e
	}
	defer tx.Rollback(ctx)
	var w work
	var contactID *string
	var snapshot []byte
	e = tx.QueryRow(ctx, `select r.id::text,r.campaign_id::text,r.email,r.first_name,r.contact_id::text,r.is_test,r.snapshot,r.attempts from csc.email_recipients r join csc.email_campaigns d on d.id=r.campaign_id where r.status='pending' and r.next_attempt_at<=now() and ($1::uuid[] is null or r.campaign_id=any($1::uuid[])) and (r.is_test or d.status in ('sending','attention')) order by r.created_at for share of d skip locked for update of r skip locked limit 1`, s.dispatchScope).Scan(&w.ID, &w.CampaignID, &w.Email, &w.FirstName, &contactID, &w.Test, &snapshot, &w.Attempts)
	if e != nil {
		return w, dbError(e)
	}
	w.Draft, e = scanDraft(tx.QueryRow(ctx, draftSelect+` where d.id=$1::uuid for share of d`, w.CampaignID))
	if e != nil {
		return w, e
	}
	eligible := true
	if !w.Test && w.Draft.Status != "sending" && w.Draft.Status != "attention" {
		eligible = false
	}
	if contactID != nil {
		c, e := scanContact(tx.QueryRow(ctx, contactSelect+` where c.id=$1::uuid for share of c`, *contactID))
		if e != nil {
			return w, e
		}
		w.Token = c.Token
		eligible = eligible && c.Subscribed && !c.Archived && c.Blocked == "" && c.Active && c.Email == w.Email
	} else {
		eligible = w.Test
		if w.Test {
			c, err := scanContact(tx.QueryRow(ctx, contactSelect+` where c.email=$1 for share of c`, w.Email))
			if err == nil {
				w.Token = c.Token
				eligible = c.Subscribed && !c.Archived && c.Blocked == "" && c.Active
			} else if !errors.Is(err, ErrNotFound) {
				return w, err
			}
		}
	}
	if w.Test && len(snapshot) > 0 {
		if e = decodeJSON(snapshot, &w.Draft); e != nil {
			return w, e
		}
	}
	if !eligible {
		_, e = tx.Exec(ctx, `update csc.email_recipients set status='skipped',reason='Unsubscribed, archived, blocked, or inactive' where id=$1::uuid`, w.ID)
		if e != nil {
			return w, e
		}
		return work{}, tx.Commit(ctx)
	}
	e = tx.QueryRow(ctx, `update csc.email_recipients set status='submitting',attempt_id=gen_random_uuid(),attempts=attempts+1,submitted_at=now() where id=$1::uuid returning attempt_id::text,attempts`, w.ID).Scan(&w.AttemptID, &w.Attempts)
	if e != nil {
		return w, e
	}
	_, e = tx.Exec(ctx, `insert into csc.email_attempts(id,recipient_id) values($1::uuid,$2::uuid)`, w.AttemptID, w.ID)
	if e != nil {
		return w, e
	}
	return w, tx.Commit(ctx)
}
func (s *Store) finish(ctx context.Context, w work, messageID string, sendErr error) error {
	status, reason := "accepted", ""
	var next any = time.Now()
	if sendErr != nil {
		status, reason = "uncertain", "Provider acceptance unknown; review before resending"
		var rejected *Rejected
		if errors.As(sendErr, &rejected) {
			status, reason = "failed", "Provider rejected this message"
			if rejected.Retry && w.Attempts < 5 {
				status, reason = "pending", "Provider throttled this message; retry queued"
				next = time.Now().Add(time.Duration(w.Attempts*w.Attempts) * time.Minute)
			}
		}
	}
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	_, e = tx.Exec(ctx, `update csc.email_attempts set status=$2,message_id=nullif($3,'') where id=$1::uuid and status='submitting'`, w.AttemptID, status, messageID)
	if e != nil {
		return e
	}
	_, e = tx.Exec(ctx, `update csc.email_recipients set status=$2,message_id=nullif($3,''),reason=$4,next_attempt_at=$5 where id=$1::uuid and attempt_id=$6::uuid and status='submitting'`, w.ID, status, messageID, reason, next, w.AttemptID)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}

// Run dispatches bounded work. Run it periodically as a job; it requires no
// persistent API process or browser. Multiple workers coordinate through locks.
func (s *Store) Run(ctx context.Context, max int, interval time.Duration) error {
	if s.Transport == nil {
		return ErrDisabled
	}
	if max < 1 || max > 5000 {
		return ErrInvalid
	}
	// One dispatch job at a time keeps the configured rate global even when a
	// scheduler starts overlapping executions. The session lock dies with its connection.
	conn, e := s.DB.Acquire(ctx)
	if e != nil {
		return e
	}
	defer conn.Release()
	var locked bool
	if e = conn.QueryRow(ctx, `select pg_try_advisory_lock(hashtext('csc.email_dispatch'))`).Scan(&locked); e != nil {
		return e
	}
	if !locked {
		return nil
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
		defer cancel()
		if _, err := conn.Exec(unlockCtx, `select pg_advisory_unlock(hashtext('csc.email_dispatch'))`); err != nil {
			_ = conn.Conn().Close(unlockCtx)
		}
	}()
	_, e = s.DB.Exec(ctx, `with expired as(update csc.email_recipients set status='uncertain',reason='Worker interrupted; provider acceptance unknown' where status='submitting' and submitted_at<now()-interval '2 minutes' and ($1::uuid[] is null or campaign_id=any($1::uuid[])) returning attempt_id) update csc.email_attempts set status='uncertain' where id in(select attempt_id from expired)`, s.dispatchScope)
	if e != nil {
		return e
	}

	for i := 0; i < max; i++ {
		if e = s.freeze(ctx); e != nil {
			return e
		}
		w, e := s.claim(ctx)
		if errors.Is(e, ErrNotFound) {
			break
		}
		if e != nil {
			return e
		}
		if w.ID == "" {
			continue
		}
		link := strings.TrimRight(s.PublicURL, "/") + "/email/preferences/" + w.Token + "?campaign=" + w.CampaignID
		if w.Token == "" {
			link = strings.TrimRight(s.PublicURL, "/") + "/email/preferences"
		}
		h, t := Render(w.Draft, w.FirstName, link)
		first := w.FirstName
		if strings.TrimSpace(first) == "" {
			first = "there"
		}
		subject := strings.ReplaceAll(w.Draft.Subject, "{{firstName}}", first)
		if w.Test {
			subject = "[TEST] " + subject
		}
		sendCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		messageID, sendErr := s.Transport.Send(sendCtx, Message{To: w.Email, Subject: subject, HTML: h, Text: t, Unsubscribe: link, CampaignID: w.CampaignID, AttemptID: w.AttemptID, Test: w.Test})
		cancel()
		saveCtx, saveCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		e = s.finish(saveCtx, w, messageID, sendErr)
		saveCancel()
		if e != nil {
			return e
		}
		timer := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
	_, e = s.DB.Exec(ctx, `update csc.email_campaigns d set status=case when exists(select 1 from csc.email_recipients r where r.campaign_id=d.id and not r.is_test and r.status in ('uncertain','failed')) then 'attention' else 'completed' end where ($1::uuid[] is null or d.id=any($1::uuid[])) and status in ('sending','attention') and not exists(select 1 from csc.email_recipients r where r.campaign_id=d.id and not r.is_test and r.status in ('pending','submitting'))`, s.dispatchScope)
	return e
}
func (s *Store) Tests(ctx context.Context, actor, id, requestID string, version int, emails []string) error {
	if s.Transport == nil {
		return ErrDisabled
	}
	if !ValidID(id) || !ValidID(requestID) || len(emails) < 1 || len(emails) > 5 {
		return ErrInvalid
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	d, e := scanDraft(tx.QueryRow(ctx, draftSelect+` where d.id=$1::uuid for share of d`, id))
	if e != nil {
		return e
	}
	if version != d.Version || strings.TrimSpace(d.Subject) == "" || len(d.Blocks) == 0 || !ReadyBlocks(d.Blocks) {
		return ErrConflict
	}
	for _, raw := range emails {
		email, e := Email(raw)
		if e != nil {
			return e
		}
		var contactID *string
		var first, token string
		var blocked bool
		e = tx.QueryRow(ctx, `select id::text,first_name,token,(not subscribed or archived or blocked_reason<>'') from csc.email_contacts where email=$1 for share`, email).Scan(&contactID, &first, &token, &blocked)
		if e != nil && !errors.Is(e, pgx.ErrNoRows) {
			return e
		}
		if blocked {
			return ErrBlocked
		}
		_, e = tx.Exec(ctx, `insert into csc.email_recipients(campaign_id,contact_id,email,first_name,is_test,test_run,snapshot) values($1::uuid,$2::uuid,$3,$4,true,$5::uuid,$6) on conflict do nothing`, id, contactID, email, first, requestID, jsonBytes(d))
		if e != nil {
			return e
		}
	}
	return tx.Commit(ctx)
}
func (s *Store) Resolve(ctx context.Context, actor, id, recipient, action string) error {
	if !ValidID(id) || !ValidID(recipient) || action != "retry" && action != "skip" {
		return ErrInvalid
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var campaignStatus string
	e = tx.QueryRow(ctx, `select status from csc.email_campaigns where id=$1::uuid for update`, id).Scan(&campaignStatus)
	if e != nil {
		return dbError(e)
	}
	if campaignStatus != "attention" && campaignStatus != "sending" {
		return ErrConflict
	}
	status := "skipped"
	if action == "retry" {
		status = "pending"
	}
	tag, e := tx.Exec(ctx, `update csc.email_recipients set status=$3,reason='Officer reviewed previous attempt',next_attempt_at=now() where id=$1::uuid and campaign_id=$2::uuid and status in ('uncertain','failed') and not is_test`, recipient, id, status)
	if e != nil {
		return e
	}
	if tag.RowsAffected() != 1 {
		return ErrConflict
	}
	_, e = tx.Exec(ctx, `update csc.email_campaigns set status='sending' where id=$1::uuid`, id)
	if e != nil {
		return e
	}
	_, e = tx.Exec(ctx, `insert into csc.email_history(campaign_id,actor_id,action,snapshot) values($1::uuid,$2::uuid,$3,$4)`, id, actor, "recipient_"+action, jsonBytes(map[string]string{"recipientId": recipient}))
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func decodeJSON(b []byte, v any) error { return json.Unmarshal(b, v) }
