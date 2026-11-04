package campaigns

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
)

type SNSMessage struct {
	Type             string  `json:"Type"`
	MessageID        string  `json:"MessageId"`
	TopicARN         string  `json:"TopicArn"`
	Subject          *string `json:"Subject"`
	Message          string  `json:"Message"`
	Timestamp        string  `json:"Timestamp"`
	SignatureVersion string  `json:"SignatureVersion"`
	Signature        string  `json:"Signature"`
	SigningCertURL   string  `json:"SigningCertURL"`
	SubscribeURL     string  `json:"SubscribeURL"`
	Token            string  `json:"Token"`
}

var certPath = regexp.MustCompile(`^/SimpleNotificationService-[A-Za-z0-9_-]+\.pem$`)

func (m SNSMessage) canonical() (string, error) {
	keys := []string{"Message", "MessageId"}
	values := map[string]string{"Message": m.Message, "MessageId": m.MessageID, "Timestamp": m.Timestamp, "TopicArn": m.TopicARN, "Type": m.Type}
	switch m.Type {
	case "Notification":
		if m.Subject != nil {
			keys = append(keys, "Subject")
			values["Subject"] = *m.Subject
		}
	case "SubscriptionConfirmation", "UnsubscribeConfirmation":
		keys = append(keys, "SubscribeURL", "Token")
		values["SubscribeURL"] = m.SubscribeURL
		values["Token"] = m.Token
	default:
		return "", ErrInvalid
	}
	keys = append(keys, "Timestamp", "TopicArn", "Type")
	var s strings.Builder
	for _, k := range keys {
		if values[k] == "" {
			return "", ErrInvalid
		}
		s.WriteString(k + "\n" + values[k] + "\n")
	}
	return s.String(), nil
}
func (m SNSMessage) verifyWith(cert *x509.Certificate) error {
	canonical, e := m.canonical()
	if e != nil {
		return e
	}
	sig, e := base64.StdEncoding.DecodeString(m.Signature)
	if e != nil {
		return ErrInvalid
	}
	pub, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok || time.Now().Before(cert.NotBefore) || time.Now().After(cert.NotAfter) {
		return ErrInvalid
	}
	switch m.SignatureVersion {
	case "1":
		h := sha1.Sum([]byte(canonical))
		return rsa.VerifyPKCS1v15(pub, crypto.SHA1, h[:], sig)
	case "2":
		h := sha256.Sum256([]byte(canonical))
		return rsa.VerifyPKCS1v15(pub, crypto.SHA256, h[:], sig)
	}
	return ErrInvalid
}
func (m SNSMessage) Verify(ctx context.Context, topic string) error {
	if topic == "" || m.TopicARN != topic {
		return ErrInvalid
	}
	parts := strings.Split(topic, ":")
	if len(parts) != 6 || parts[0] != "arn" || parts[1] != "aws" || parts[2] != "sns" || parts[3] == "" {
		return ErrInvalid
	}
	u, e := url.Parse(m.SigningCertURL)
	if e != nil || u.Scheme != "https" || u.Host != "sns."+parts[3]+".amazonaws.com" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || !certPath.MatchString(u.Path) {
		return ErrInvalid
	}
	client := http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("redirect refused") }}
	req, e := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if e != nil {
		return e
	}
	res, e := client.Do(req)
	if e != nil {
		return ErrInvalid
	}
	defer res.Body.Close()
	b, e := io.ReadAll(io.LimitReader(res.Body, 32769))
	if e != nil || res.StatusCode != 200 || len(b) > 32768 {
		return ErrInvalid
	}
	block, _ := pem.Decode(b)
	if block == nil {
		return ErrInvalid
	}
	cert, e := x509.ParseCertificate(block.Bytes)
	if e != nil {
		return ErrInvalid
	}
	return m.verifyWith(cert)
}

type sesEvent struct {
	EventType string `json:"eventType"`
	Mail      struct {
		MessageID string              `json:"messageId"`
		Tags      map[string][]string `json:"tags"`
	} `json:"mail"`
	Delivery struct {
		Timestamp time.Time `json:"timestamp"`
	} `json:"delivery"`
	Bounce struct {
		BounceType string    `json:"bounceType"`
		Timestamp  time.Time `json:"timestamp"`
	} `json:"bounce"`
	Complaint struct {
		Timestamp time.Time `json:"timestamp"`
	} `json:"complaint"`
	Click struct {
		Link       string    `json:"link"`
		Timestamp  time.Time `json:"timestamp"`
		IsBotEvent string    `json:"isBotEvent"`
	} `json:"click"`
}

func (s *Store) Ingest(ctx context.Context, m SNSMessage) error {
	var ev sesEvent
	if e := json.Unmarshal([]byte(m.Message), &ev); e != nil {
		return ErrInvalid
	}
	get := func(k string) string {
		vs := ev.Mail.Tags[k]
		if len(vs) != 1 {
			return ""
		}
		return vs[0]
	}
	attempt, campaign := get("attempt"), get("campaign")
	if !ValidID(attempt) || !ValidID(campaign) {
		return ErrInvalid
	}
	kind := strings.ToLower(ev.EventType)
	switch kind {
	case "send", "delivery", "bounce", "complaint", "click", "reject", "rendering failure", "deliverydelay":
	default:
		return nil
	}
	var when time.Time
	block := ""
	link := ""
	bot := false
	switch kind {
	case "delivery":
		when = ev.Delivery.Timestamp
	case "bounce":
		when = ev.Bounce.Timestamp
		if ev.Bounce.BounceType == "Permanent" {
			block = "bounce"
		}
	case "complaint":
		when = ev.Complaint.Timestamp
		block = "complaint"
	case "click":
		when = ev.Click.Timestamp
		link = ev.Click.Link
		bot = ev.Click.IsBotEvent == "Likely"
	}
	if when.IsZero() {
		when = time.Now()
	}
	if len(link) > 4000 {
		return ErrInvalid
	}
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var recipient, email string
	var contact *string
	e = tx.QueryRow(ctx, `select r.id::text,r.email,r.contact_id::text from csc.email_attempts a join csc.email_recipients r on r.id=a.recipient_id where a.id=$1::uuid and r.campaign_id=$2::uuid`, attempt, campaign).Scan(&recipient, &email, &contact)
	if e != nil {
		return dbError(e)
	}
	var canonical any
	if json.Unmarshal([]byte(m.Message), &canonical) != nil {
		return ErrInvalid
	}
	digest := sha256.Sum256(jsonBytes(canonical))
	providerID := "ses:" + hex.EncodeToString(digest[:])
	tag, e := tx.Exec(ctx, `insert into csc.email_events(provider_id,campaign_id,recipient_id,kind,link,bot,payload,occurred_at) values($1,$2::uuid,$3::uuid,$4,$5,$6,$7,$8) on conflict(provider_id) do nothing`, providerID, campaign, recipient, kind, link, bot, []byte(m.Message), when)
	if e != nil {
		return e
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	if block != "" {
		_, e = tx.Exec(ctx, `insert into csc.email_contacts(email,subscribed,blocked_reason) values($1,false,$2) on conflict(email) do update set blocked_reason=case when csc.email_contacts.blocked_reason='complaint' then 'complaint' else excluded.blocked_reason end,version=csc.email_contacts.version+1,updated_at=now()`, email, block)
		if e != nil {
			return e
		}
	}
	if kind == "send" || kind == "delivery" || kind == "click" || kind == "bounce" || kind == "complaint" {
		_, e = tx.Exec(ctx, `update csc.email_attempts set status='accepted',message_id=$2 where id=$1::uuid`, attempt, ev.Mail.MessageID)
		if e != nil {
			return e
		}
		_, e = tx.Exec(ctx, `update csc.email_recipients set status='accepted',message_id=$2,reason='' where id=$1::uuid and attempt_id=$3::uuid and status in ('submitting','uncertain')`, recipient, ev.Mail.MessageID, attempt)
		if e != nil {
			return e
		}
	}
	return tx.Commit(ctx)
}

// Confirm only the configured topic after signature verification. Never follow
// a subscription URL supplied in the request body.
func (s *Store) ConfirmSNS(ctx context.Context, m SNSMessage) error {
	if m.TopicARN != s.TopicARN || m.Type != "SubscriptionConfirmation" || m.Token == "" {
		return ErrInvalid
	}
	parts := strings.Split(s.TopicARN, ":")
	if len(parts) != 6 {
		return ErrInvalid
	}
	cfg, e := config.LoadDefaultConfig(ctx, config.WithRegion(parts[3]))
	if e != nil {
		return ErrDisabled
	}
	_, e = sns.NewFromConfig(cfg).ConfirmSubscription(ctx, &sns.ConfirmSubscriptionInput{TopicArn: aws.String(s.TopicARN), Token: aws.String(m.Token), AuthenticateOnUnsubscribe: aws.String("true")})
	if e != nil {
		return errors.New("SNS subscription confirmation unavailable")
	}
	return nil
}
