package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const userID = "11111111-1111-4111-8111-111111111111"
const sessionID = "22222222-2222-4222-8222-222222222222"

type sessionFunc func(context.Context, string, string) (Identity, error)

func (f sessionFunc) Lookup(ctx context.Context, user, session string) (Identity, error) {
	return f(ctx, user, session)
}

func newKey(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func jwk(key *ecdsa.PrivateKey, kid string) map[string]string {
	return map[string]string{"kid": kid, "kty": "EC", "alg": "ES256", "crv": "P-256", "use": "sig",
		"x": base64.RawURLEncoding.EncodeToString(key.X.FillBytes(make([]byte, 32))),
		"y": base64.RawURLEncoding.EncodeToString(key.Y.FillBytes(make([]byte, 32)))}
}

func validClaims(issuer string) claims {
	return claims{RegisteredClaims: jwt.RegisteredClaims{
		Issuer: issuer, Subject: userID, Audience: jwt.ClaimStrings{"authenticated"},
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)), IssuedAt: jwt.NewNumericDate(time.Now()),
	}, SessionID: sessionID, Email: "student@pitt.edu", Role: "authenticated"}
}

func sign(t *testing.T, key *ecdsa.PrivateKey, kid string, c claims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, c)
	token.Header["kid"] = kid
	encoded, err := token.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return "Bearer " + encoded
}

func TestVerifyTokens(t *testing.T) {
	key := newKey(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			t.Error("wrong discovery path")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{jwk(key, "current")}})
	}))
	defer server.Close()
	issuer := server.URL + "/auth/v1"
	var lookups int
	v, err := NewVerifier(issuer, sessionFunc(func(ctx context.Context, user, session string) (Identity, error) {
		lookups++
		if user != userID || session != sessionID {
			t.Fatal("unverified identity used")
		}
		return Identity{ID: user, Email: "student@pitt.edu"}, nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		change func(*claims)
	}{
		{"wrong project", func(c *claims) { c.Issuer = "https://other.supabase.co/auth/v1" }},
		{"wrong audience", func(c *claims) { c.Audience = jwt.ClaimStrings{"anon"} }},
		{"missing expiry", func(c *claims) { c.ExpiresAt = nil }},
		{"expired", func(c *claims) { c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute)) }},
		{"future issued", func(c *claims) { c.IssuedAt = jwt.NewNumericDate(time.Now().Add(time.Hour)) }},
		{"future activation", func(c *claims) { c.NotBefore = jwt.NewNumericDate(time.Now().Add(time.Hour)) }},
		{"missing subject", func(c *claims) { c.Subject = "" }},
		{"missing session", func(c *claims) { c.SessionID = "" }},
		{"service role", func(c *claims) { c.Role = "service_role" }},
		{"anonymous", func(c *claims) { c.Anonymous = true }},
		{"other email", func(c *claims) { c.Email = "student@example.com" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := validClaims(issuer)
			tc.change(&c)
			if _, err := v.Authenticate(context.Background(), sign(t, key, "current", c)); !errors.Is(err, ErrUnauthorized) {
				t.Fatalf("got %v", err)
			}
		})
	}
	for _, header := range []string{"", "Bearer", "Basic abc", "Bearer a.b.c", "Bearer a b",
		sign(t, newKey(t), "current", validClaims(issuer)), sign(t, key, "", validClaims(issuer))} {
		if _, err := v.Authenticate(context.Background(), header); !errors.Is(err, ErrUnauthorized) {
			t.Fatalf("invalid token accepted: %v", err)
		}
	}
	hmac := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims(issuer))
	hmac.Header["kid"] = "current"
	encoded, _ := hmac.SignedString([]byte("not-a-project-key"))
	if _, err := v.Authenticate(context.Background(), "Bearer "+encoded); !errors.Is(err, ErrUnauthorized) {
		t.Fatal("symmetric algorithm accepted")
	}
	if lookups != 0 {
		t.Fatal("invalid tokens reached database")
	}
	if _, err := v.Authenticate(context.Background(), sign(t, key, "current", validClaims(issuer))); err != nil {
		t.Fatal(err)
	}
	if lookups != 1 {
		t.Fatal("live session not checked")
	}
}

func TestLiveSessionRevocationAndFailures(t *testing.T) {
	key := newKey(t)
	var stateErr error
	email := "student@pitt.edu"
	v, _ := NewVerifier("http://localhost/auth/v1", sessionFunc(func(context.Context, string, string) (Identity, error) {
		return Identity{ID: userID, Email: email}, stateErr
	}))
	v.keys.keys = map[string]signingKey{"key": {algorithm: "ES256", public: &key.PublicKey}}
	v.keys.expires = time.Now().Add(time.Hour)
	header := sign(t, key, "key", validClaims(v.issuer))
	if _, err := v.Authenticate(context.Background(), header); err != nil {
		t.Fatal(err)
	}
	stateErr = ErrUnauthorized
	if _, err := v.Authenticate(context.Background(), header); !errors.Is(err, ErrUnauthorized) {
		t.Fatal("revoked session still authorized")
	}
	stateErr = ErrUnavailable
	if _, err := v.Authenticate(context.Background(), header); !errors.Is(err, ErrUnavailable) {
		t.Fatal("DB failure must fail closed but remain retryable")
	}
	stateErr, email = nil, "changed@example.com"
	if _, err := v.Authenticate(context.Background(), header); !errors.Is(err, ErrUnauthorized) {
		t.Fatal("current non-Pitt identity accepted")
	}
}

func TestJWKSCacheRotationAndOutage(t *testing.T) {
	first, second := newKey(t), newKey(t)
	var requests atomic.Int32
	var rotated, unavailable atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if unavailable.Load() {
			w.WriteHeader(503)
			return
		}
		keys := []any{jwk(first, "first")}
		if rotated.Load() {
			keys = []any{jwk(second, "second")}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": keys})
	}))
	defer server.Close()
	now := time.Now()
	cache := &keyCache{url: server.URL, client: server.Client(), now: func() time.Time { return now }}
	var wg sync.WaitGroup
	for range 20 {
		wg.Go(func() {
			if _, err := cache.lookup(context.Background(), "first", "ES256"); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if requests.Load() != 1 {
		t.Fatal("concurrent requests must share JWKS fetch")
	}
	if _, err := cache.lookup(context.Background(), "unknown", "ES256"); !errors.Is(err, ErrUnauthorized) {
		t.Fatal(err)
	}
	if requests.Load() != 1 {
		t.Fatal("unknown keys bypassed refresh throttle")
	}
	now = now.Add(6 * time.Second)
	rotated.Store(true)
	if _, err := cache.lookup(context.Background(), "second", "ES256"); err != nil {
		t.Fatal("rotation failed", err)
	}
	if _, err := cache.lookup(context.Background(), "first", "ES256"); !errors.Is(err, ErrUnauthorized) {
		t.Fatal("removed key accepted")
	}
	if _, err := cache.lookup(context.Background(), "second", "RS256"); !errors.Is(err, ErrUnauthorized) {
		t.Fatal("wrong key algorithm accepted")
	}
	now = now.Add(11 * time.Minute)
	unavailable.Store(true)
	if _, err := cache.lookup(context.Background(), "second", "ES256"); !errors.Is(err, ErrUnavailable) {
		t.Fatal("expired JWKS must fail closed")
	}
	now = now.Add(6 * time.Second)
	unavailable.Store(false)
	if _, err := cache.lookup(context.Background(), "second", "ES256"); err != nil {
		t.Fatal("outage recovery failed", err)
	}
}

func TestIssuerConfiguration(t *testing.T) {
	sessions := sessionFunc(func(context.Context, string, string) (Identity, error) { return Identity{}, nil })
	for _, issuer := range []string{"", "http://example.com/auth/v1", "https://x/auth/v1?token=secret", "https://user:pass@x/auth/v1", "https://x/"} {
		if _, err := NewVerifier(issuer, sessions); err == nil {
			t.Fatal("invalid issuer accepted")
		}
	}
}
