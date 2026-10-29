package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"
)

type signingKey struct {
	algorithm string
	public    any
}
type keyCache struct {
	mu          sync.Mutex
	url         string
	client      *http.Client
	keys        map[string]signingKey
	expires     time.Time
	nextRefresh time.Time
	lastError   error
	now         func() time.Time
}

func (c *keyCache) lookup(ctx context.Context, kid, algorithm string) (any, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	key, found := c.keys[kid]
	if found && now.Before(c.expires) {
		if key.algorithm != algorithm {
			return nil, ErrUnauthorized
		}
		return key.public, nil
	}
	// Refresh on an unknown kid for rotation, bounded to one fetch every five
	// seconds so arbitrary headers cannot generate unbounded JWKS traffic.
	if now.Before(c.nextRefresh) {
		if c.lastError != nil {
			return nil, ErrUnavailable
		}
		return nil, ErrUnauthorized
	}
	c.nextRefresh = now.Add(5 * time.Second)
	keys, err := c.fetch(ctx)
	c.lastError = err
	if err != nil {
		return nil, ErrUnavailable
	}
	c.keys, c.expires = keys, now.Add(10*time.Minute)
	key, found = keys[kid]
	if !found || key.algorithm != algorithm {
		return nil, ErrUnauthorized
	}
	return key.public, nil
}

func (c *keyCache) fetch(ctx context.Context) (map[string]signingKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return nil, ErrUnavailable
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, ErrUnavailable
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, ErrUnavailable
	}
	var set struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Use string `json:"use"`
			Crv string `json:"crv"`
			X   string `json:"x"`
			Y   string `json:"y"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, (1<<20)+1))
	if err != nil || len(body) > 1<<20 || json.Unmarshal(body, &set) != nil {
		return nil, ErrUnavailable
	}
	keys := make(map[string]signingKey)
	for _, k := range set.Keys {
		if k.Kid == "" || (k.Use != "" && k.Use != "sig") {
			continue
		}
		var public any
		switch {
		case k.Kty == "EC" && k.Alg == "ES256" && k.Crv == "P-256":
			x, ex := base64.RawURLEncoding.DecodeString(k.X)
			y, ey := base64.RawURLEncoding.DecodeString(k.Y)
			if ex != nil || ey != nil || len(x) != 32 || len(y) != 32 {
				return nil, ErrUnavailable
			}
			pk := &ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(x), Y: new(big.Int).SetBytes(y)}
			if !pk.Curve.IsOnCurve(pk.X, pk.Y) {
				return nil, ErrUnavailable
			}
			public = pk
		case k.Kty == "RSA" && k.Alg == "RS256":
			n, en := base64.RawURLEncoding.DecodeString(k.N)
			e, ee := base64.RawURLEncoding.DecodeString(k.E)
			if en != nil || ee != nil || len(e) == 0 || len(e) > 4 {
				return nil, ErrUnavailable
			}
			modulus, exponent := new(big.Int).SetBytes(n), new(big.Int).SetBytes(e).Int64()
			if modulus.BitLen() < 2048 || modulus.BitLen() > 8192 || exponent < 3 || exponent > 2147483647 || exponent%2 == 0 {
				return nil, ErrUnavailable
			}
			public = &rsa.PublicKey{N: modulus, E: int(exponent)}
		default:
			continue // Symmetric and unsupported keys are never trusted.
		}
		if _, duplicate := keys[k.Kid]; duplicate {
			return nil, ErrUnavailable
		}
		keys[k.Kid] = signingKey{algorithm: k.Alg, public: public}
	}
	if len(keys) == 0 {
		return nil, ErrUnavailable
	}
	return keys, nil
}
