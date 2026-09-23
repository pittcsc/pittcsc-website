// Package auth verifies Supabase identities. CRM roles and account status must
// additionally be authorized by each future CRM feature using current DB data.
package auth

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrUnauthorized = errors.New("authentication required")
	ErrUnavailable  = errors.New("authentication temporarily unavailable")
	uuidPattern     = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	pittEmail       = regexp.MustCompile(`(?i)^[^@\s]+@pitt\.edu$`)
)

type Identity struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type Sessions interface {
	// Lookup must read current state, without caching. A signed JWT alone is not
	// sufficient: local sign-out removes its session before the JWT expires.
	Lookup(context.Context, string, string) (Identity, error)
}

type claims struct {
	jwt.RegisteredClaims
	SessionID string `json:"session_id"`
	Role      string `json:"role"`
	Email     string `json:"email"`
	Anonymous bool   `json:"is_anonymous"`
}

type Verifier struct {
	issuer   string
	keys     *keyCache
	sessions Sessions
}

func NewVerifier(issuer string, sessions Sessions) (*Verifier, error) {
	u, err := url.Parse(issuer)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "/auth/v1" || sessions == nil {
		return nil, errors.New("SUPABASE_AUTH_URL must be the project's /auth/v1 issuer URL")
	}
	local := u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1"
	if u.Scheme != "https" && !(u.Scheme == "http" && local) {
		return nil, errors.New("SUPABASE_AUTH_URL requires HTTPS outside localhost")
	}
	return &Verifier{issuer: issuer, sessions: sessions, keys: &keyCache{
		url:    issuer + "/.well-known/jwks.json",
		client: &http.Client{Timeout: 3 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }},
		now:    time.Now,
	}}, nil
}

func (v *Verifier) Authenticate(ctx context.Context, authorization string) (Identity, error) {
	parts := strings.Fields(authorization)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || len(parts[1]) > 16384 {
		return Identity{}, ErrUnauthorized
	}
	c := new(claims)
	_, err := jwt.ParseWithClaims(parts[1], c, func(token *jwt.Token) (any, error) {
		kid, ok := token.Header["kid"].(string)
		if !ok || kid == "" || len(kid) > 256 {
			return nil, ErrUnauthorized
		}
		return v.keys.lookup(ctx, kid, token.Method.Alg())
	}, jwt.WithValidMethods([]string{"ES256", "RS256"}), jwt.WithIssuer(v.issuer),
		jwt.WithAudience("authenticated"), jwt.WithExpirationRequired(), jwt.WithIssuedAt())
	if err != nil {
		if errors.Is(err, ErrUnavailable) {
			return Identity{}, ErrUnavailable
		}
		return Identity{}, ErrUnauthorized
	}
	if !uuidPattern.MatchString(c.Subject) || !uuidPattern.MatchString(c.SessionID) ||
		c.Role != "authenticated" || c.Anonymous || !pittEmail.MatchString(c.Email) {
		return Identity{}, ErrUnauthorized
	}
	identity, err := v.sessions.Lookup(ctx, c.Subject, c.SessionID)
	if err != nil {
		return Identity{}, err
	}
	if identity.ID != c.Subject || !pittEmail.MatchString(identity.Email) {
		return Identity{}, ErrUnauthorized
	}
	return identity, nil
}
