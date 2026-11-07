package campaigns

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"strings"
	"testing"
	"time"
)

func TestAudienceOptionalDataAndExclusions(t *testing.T) {
	c := Contact{FirstName: "First", Email: "member@example.test", Subscribed: true, Active: true, Tags: []string{"newsletter"}}
	a := Audience{Mode: "all", Conditions: []Condition{}, Exclusions: []Condition{}}
	if !a.Matches(c) {
		t.Fatal("optional data must not prevent general newsletters")
	}
	a.Conditions = []Condition{{Field: "major", Value: "Computer Science"}}
	if a.Matches(c) {
		t.Fatal("null major cannot match")
	}
	a.Mode = "any"
	a.Conditions = append(a.Conditions, Condition{Field: "tag", Value: "NEWSLETTER"})
	if !a.Matches(c) {
		t.Fatal("tag should match independently of optional data")
	}
	a.Exclusions = []Condition{{Field: "tag", Value: "newsletter"}}
	if a.Matches(c) {
		t.Fatal("exclusion must win")
	}
	a.Exclusions = nil
	c.Subscribed = false
	if a.Matches(c) || !a.MatchesRules(c) {
		t.Fatal("subscription eligibility must not change attribute-only contact filtering")
	}
}
func TestImportParsing(t *testing.T) {
	in := ImportInput{CSV: "First,Last,Email,Tags,Year\r\n\"First, Name\",Last, USER@EXAMPLE.TEST ,\"a;b\",\r\nOther,Last,user@example.test,,\r\nNo,Email,not-an-email,,\r\n", Mapping: map[string]int{"firstName": 0, "lastName": 1, "email": 2, "tags": 3, "graduationYear": 4}}
	rows, e := ParseImport(in)
	if e != nil || len(rows) != 3 {
		t.Fatal("CSV parse failed")
	}
	if rows[0].Input.Email != "user@example.test" || rows[0].Input.Year != nil || len(rows[0].Input.Tags) != 2 || rows[0].Error != "" {
		t.Fatal("normalization or nullable fields incorrect")
	}
	if rows[1].Error == "" || rows[2].Error == "" {
		t.Fatal("duplicates and invalid rows must be flagged")
	}
	in.Mapping["email"] = 99
	if _, e = ParseImport(in); !errors.Is(e, ErrInvalid) {
		t.Fatal("out-of-bounds mapping accepted")
	}
}
func TestRendererEscapesContentAndURLs(t *testing.T) {
	bs := []Block{{Type: "heading", Text: "Hi {{firstName}}"}, {Type: "text", Text: "**Welcome** [club](https://example.test/?a=1&b=2) <script>alert(1)</script>"}}
	if ValidateBlocks(bs) != nil {
		t.Fatal("valid blocks rejected")
	}
	h, plain := Render(Draft{Blocks: bs}, `<img src=x onerror=alert(1)>`, "https://example.test/unsubscribe")
	if strings.Contains(h, "<script>") || strings.Contains(h, "<img src=x") || !strings.Contains(h, "<strong>Welcome</strong>") || !strings.Contains(plain, "Unsubscribe:") {
		t.Fatal("unsafe rendering")
	}
	for _, b := range []Block{{Type: "image", URL: "javascript:alert(1)"}, {Type: "button", URL: "https://example.test/\" onclick=alert(1)"}, {Type: "raw", Text: "<script>"}} {
		if ValidateBlocks([]Block{b}) == nil {
			t.Fatal("unsafe block accepted")
		}
	}
}
func TestMIMEAndCSV(t *testing.T) {
	raw, e := rawMail("CSC <sender@example.test>", Message{To: "reader@example.test", Subject: "News ☀", HTML: "<p>Hello</p>", Text: "Hello", Unsubscribe: "https://example.test/unsubscribe"})
	if e != nil {
		t.Fatal(e)
	}
	m, e := mail.ReadMessage(bytes.NewReader(raw))
	if e != nil || m.Header.Get("List-Unsubscribe-Post") != "List-Unsubscribe=One-Click" {
		t.Fatal("missing unsubscribe headers")
	}
	_, params, _ := mime.ParseMediaType(m.Header.Get("Content-Type"))
	r := multipart.NewReader(m.Body, params["boundary"])
	for range 2 {
		p, e := r.NextPart()
		if e != nil {
			t.Fatal(e)
		}
		b, _ := io.ReadAll(p)
		decoded, e := base64.StdEncoding.DecodeString(strings.ReplaceAll(strings.TrimSpace(string(b)), "\r\n", ""))
		if e != nil || len(decoded) == 0 {
			t.Fatal("invalid MIME body")
		}
	}
	var out bytes.Buffer
	if e = WriteCSV(&out, [][]string{{"=HYPERLINK(\"x\")", " \t@SUM(A1)", "ordinary, text"}}); e != nil || !strings.Contains(out.String(), "'=HYPERLINK") || !strings.Contains(out.String(), "' \t@SUM") {
		t.Fatal("CSV formula protection failed")
	}
	if _, e = rawMail("CSC <sender@example.test>", Message{To: "a@example.test", Subject: "Hello\r\nBcc:other@example.test"}); e == nil {
		t.Fatal("header injection accepted")
	}
}
func TestScheduleAndValidation(t *testing.T) {
	for _, raw := range []string{"2030-03-10T02:30", "2030-11-03T01:30", "2020-01-01T12:00", "nonsense"} {
		if _, e := ScheduleTime(raw); e == nil {
			t.Fatalf("invalid wall time accepted: %s", raw)
		}
	}
	if _, e := ScheduleTime("2030-01-15T12:00"); e != nil {
		t.Fatal("valid New York date rejected")
	}
	if ValidatePublicURL("http://localhost:8080", "ses") == nil || ValidatePublicURL("https://api.example.test", "ses") != nil {
		t.Fatal("public URL validation failed")
	}
}
func TestSNSSignatureAndTrustBoundaries(t *testing.T) {
	key, e := rsa.GenerateKey(rand.Reader, 2048)
	if e != nil {
		t.Fatal(e)
	}
	cert := &x509.Certificate{PublicKey: &key.PublicKey, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour)}
	m := SNSMessage{Type: "Notification", MessageID: "unique-event", TopicARN: "arn:aws:sns:us-east-1:123456789012:campaign", Message: `{"eventType":"Delivery"}`, Timestamp: time.Now().Format(time.RFC3339), SignatureVersion: "2"}
	canonical, _ := m.canonical()
	hash := sha256.Sum256([]byte(canonical))
	sig, e := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if e != nil {
		t.Fatal(e)
	}
	m.Signature = base64.StdEncoding.EncodeToString(sig)
	if m.verifyWith(cert) != nil {
		t.Fatal("valid SNS signature rejected")
	}
	m.Message += "tampered"
	if m.verifyWith(cert) == nil {
		t.Fatal("forged event accepted")
	}
	for _, u := range []string{"http://sns.us-east-1.amazonaws.com/SimpleNotificationService-a.pem", "https://sns.us-east-1.amazonaws.com.evil.test/SimpleNotificationService-a.pem", "https://127.0.0.1/a.pem", "https://sns.us-east-1.amazonaws.com:443/SimpleNotificationService-a.pem"} {
		m.SigningCertURL = u
		if m.Verify(context.Background(), m.TopicARN) == nil {
			t.Fatal("untrusted certificate URL accepted")
		}
	}
	b, _ := json.Marshal(m)
	if len(b) == 0 {
		t.Fatal("marshal failed")
	}
}

func TestIncompleteBlocksSaveButCannotSend(t *testing.T) {
	bs := []Block{{Type: "image"}, {Type: "button", Text: "Link"}}
	if ValidateBlocks(bs) != nil || ReadyBlocks(bs) {
		t.Fatal("draft completeness must be separate from send readiness")
	}
	bs[0].URL = "https://example.test/a.png"
	bs[1].URL = "https://example.test"
	if !ReadyBlocks(bs) {
		t.Fatal("complete blocks rejected")
	}
}
