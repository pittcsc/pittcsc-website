package campaigns

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
	"github.com/aws/smithy-go"
	"mime"
	"mime/multipart"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"net/url"
	"os"
	"strings"
	"time"
)

type Message struct {
	To, Subject, HTML, Text, Unsubscribe, CampaignID, AttemptID string
	Test                                                        bool
}
type Transport interface {
	Send(context.Context, Message) (string, error)
}

// Rejected means the provider definitively did not accept the message. All
// other errors are ambiguous and must not be retried without review.
type Rejected struct{ Retry bool }

func (e *Rejected) Error() string { return "provider rejected email" }

type SES struct {
	Client              *sesv2.Client
	From, Configuration string
}

func rawMail(from string, m Message) ([]byte, error) {
	if _, e := mail.ParseAddress(from); e != nil {
		return nil, ErrInvalid
	}
	if _, e := Email(m.To); e != nil || !validText(m.Subject, 250, false) {
		return nil, ErrInvalid
	}
	var body bytes.Buffer
	multi := multipart.NewWriter(&body)
	for _, part := range []struct{ kind, text string }{{"text/plain", m.Text}, {"text/html", m.HTML}} {
		h := textproto.MIMEHeader{}
		h.Set("Content-Type", part.kind+`; charset="UTF-8"`)
		h.Set("Content-Transfer-Encoding", "base64")
		w, e := multi.CreatePart(h)
		if e != nil {
			return nil, e
		}
		encoded := base64.StdEncoding.EncodeToString([]byte(part.text))
		for len(encoded) > 76 {
			_, _ = fmt.Fprint(w, encoded[:76]+"\r\n")
			encoded = encoded[76:]
		}
		_, _ = fmt.Fprint(w, encoded+"\r\n")
	}
	if e := multi.Close(); e != nil {
		return nil, e
	}
	var head strings.Builder
	fmt.Fprintf(&head, "From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=%q\r\n", from, m.To, mime.QEncoding.Encode("UTF-8", m.Subject), multi.Boundary())
	if m.Unsubscribe != "" {
		if strings.ContainsAny(m.Unsubscribe, "\r\n<>") {
			return nil, ErrInvalid
		}
		fmt.Fprintf(&head, "List-Unsubscribe: <%s>\r\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n", m.Unsubscribe)
	}
	return append([]byte(head.String()+"\r\n"), body.Bytes()...), nil
}
func (s *SES) Send(ctx context.Context, m Message) (string, error) {
	data, e := rawMail(s.From, m)
	if e != nil {
		return "", &Rejected{}
	}
	in := &sesv2.SendEmailInput{FromEmailAddress: aws.String(s.From), Destination: &types.Destination{ToAddresses: []string{m.To}}, Content: &types.EmailContent{Raw: &types.RawMessage{Data: data}}}
	if m.CampaignID != "" {
		in.ConfigurationSetName = aws.String(s.Configuration)
		in.EmailTags = []types.MessageTag{{Name: aws.String("campaign"), Value: aws.String(m.CampaignID)}, {Name: aws.String("attempt"), Value: aws.String(m.AttemptID)}}
	}
	out, e := s.Client.SendEmail(ctx, in)
	if e != nil {
		var api smithy.APIError
		if errors.As(e, &api) {
			switch api.ErrorCode() {
			case "TooManyRequestsException", "ThrottlingException", "LimitExceededException":
				return "", &Rejected{Retry: true}
			case "MessageRejected", "BadRequestException", "MailFromDomainNotVerifiedException", "AccountSuspendedException", "SendingPausedException", "NotFoundException":
				return "", &Rejected{}
			}
		}
		return "", errors.New("email acceptance could not be confirmed")
	}
	if out.MessageId == nil {
		return "", errors.New("email acceptance could not be confirmed")
	}
	return *out.MessageId, nil
}

type localSMTP struct {
	From    string
	Address string
}

func (s localSMTP) Send(ctx context.Context, m Message) (string, error) {
	if e := ctx.Err(); e != nil {
		return "", e
	}
	data, e := rawMail(s.From, m)
	if e != nil {
		return "", &Rejected{}
	}
	a, _ := mail.ParseAddress(s.From)
	conn, e := (&net.Dialer{}).DialContext(ctx, "tcp", s.Address)
	if e != nil {
		return "", &Rejected{Retry: true}
	}
	defer conn.Close()
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}
	client, e := smtp.NewClient(conn, "localhost")
	if e != nil {
		return "", errors.New("local mail acceptance could not be confirmed")
	}
	defer client.Close()
	if e = client.Mail(a.Address); e == nil {
		e = client.Rcpt(m.To)
	}
	if e != nil {
		return "", &Rejected{}
	}
	writer, e := client.Data()
	if e != nil {
		return "", errors.New("local mail acceptance could not be confirmed")
	}
	if _, e = writer.Write(data); e != nil {
		return "", errors.New("local mail acceptance could not be confirmed")
	}
	if e = writer.Close(); e != nil {
		return "", errors.New("local mail acceptance could not be confirmed")
	}
	_ = client.Quit()

	return "local-" + m.AttemptID, nil
}
func NewTransport(ctx context.Context) (Transport, error) {
	switch os.Getenv("CAMPAIGN_MAIL_MODE") {
	case "", "disabled":
		return nil, nil
	case "local":
		address := os.Getenv("CAMPAIGN_LOCAL_SMTP_ADDR")
		if address == "" {
			address = "127.0.0.1:54325"
		}
		host, _, err := net.SplitHostPort(address)
		ip := net.ParseIP(host)
		if err != nil || !(host == "localhost" || ip != nil && ip.IsLoopback()) {
			return nil, errors.New("local campaign SMTP must use loopback")
		}
		return localSMTP{From: "Pitt CSC <campaigns@pittcsc.test>", Address: address}, nil
	case "ses":
		from := os.Getenv("CAMPAIGN_FROM")
		a, e := mail.ParseAddress(from)
		if e != nil || !validText(from, 320, false) || os.Getenv("CAMPAIGN_CONFIGURATION_SET") == "" || os.Getenv("AWS_REGION") == "" || os.Getenv("CAMPAIGN_SNS_TOPIC_ARN") == "" {
			return nil, errors.New("configure CAMPAIGN_FROM, CAMPAIGN_CONFIGURATION_SET, CAMPAIGN_SNS_TOPIC_ARN, and AWS_REGION")
		}
		cfg, e := config.LoadDefaultConfig(ctx, config.WithRetryMaxAttempts(1))
		if e != nil {
			return nil, errors.New("AWS campaign configuration unavailable")
		}
		client := sesv2.NewFromConfig(cfg)
		checkCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		account, e := client.GetAccount(checkCtx, &sesv2.GetAccountInput{})
		if e != nil || !account.SendingEnabled || !account.ProductionAccessEnabled {
			return nil, errors.New("SES must have sending enabled and production access in AWS_REGION")
		}
		identity := strings.Split(a.Address, "@")[1]
		out, e := client.GetEmailIdentity(checkCtx, &sesv2.GetEmailIdentityInput{EmailIdentity: aws.String(identity)})
		if e != nil || !out.VerifiedForSendingStatus {
			return nil, errors.New("verify the campaign sender domain in SES before enabling delivery")
		}
		destinations, e := client.GetConfigurationSetEventDestinations(checkCtx, &sesv2.GetConfigurationSetEventDestinationsInput{ConfigurationSetName: aws.String(os.Getenv("CAMPAIGN_CONFIGURATION_SET"))})
		if e != nil {
			return nil, errors.New("campaign configuration set unavailable")
		}
		events := map[string]bool{}
		for _, destination := range destinations.EventDestinations {
			if destination.Enabled && destination.SnsDestination != nil && aws.ToString(destination.SnsDestination.TopicArn) == os.Getenv("CAMPAIGN_SNS_TOPIC_ARN") {
				for _, kind := range destination.MatchingEventTypes {
					events[string(kind)] = true
				}
			}
		}
		for _, kind := range []string{"SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "CLICK"} {
			if !events[kind] {
				return nil, errors.New("enable SEND, DELIVERY, BOUNCE, COMPLAINT, and CLICK on the configured SNS destination")
			}
		}
		return &SES{Client: client, From: from, Configuration: os.Getenv("CAMPAIGN_CONFIGURATION_SET")}, nil
	default:
		return nil, errors.New("CAMPAIGN_MAIL_MODE must be disabled, local, or ses")
	}
}

func ValidatePublicURL(raw, mode string) error {
	u, e := url.Parse(raw)
	if e != nil || !safeURL(raw) || u.RawQuery != "" || u.Fragment != "" || u.Path != "" && u.Path != "/" {
		return errors.New("CAMPAIGN_PUBLIC_URL must be an HTTP(S) API origin")
	}
	if mode == "ses" && (u.Scheme != "https" || u.Hostname() == "localhost" || net.ParseIP(u.Hostname()) != nil) {
		return errors.New("SES requires a public HTTPS CAMPAIGN_PUBLIC_URL")
	}
	return nil
}
