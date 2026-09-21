package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type pingFunc func(context.Context) error

func (f pingFunc) Ping(ctx context.Context) error { return f(ctx) }

func TestHealth(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		code int
		body string
	}{
		{"connected", nil, http.StatusOK, `{"database":"connected","status":"ok"}`},
		{"unavailable", errors.New("private connection details"), http.StatusServiceUnavailable, `{"database":"unavailable","status":"unavailable"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler := NewHandler(pingFunc(func(ctx context.Context) error {
				deadline, ok := ctx.Deadline()
				if !ok || time.Until(deadline) > 2*time.Second {
					t.Error("database check must have a bounded deadline")
				}
				return tc.err
			}), "http://localhost:8000")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health", nil))
			if response.Code != tc.code || strings.TrimSpace(response.Body.String()) != tc.body {
				t.Fatalf("got %d %s", response.Code, response.Body.String())
			}
			if response.Header().Get("Cache-Control") != "no-store" || response.Header().Get("Content-Type") != "application/json" {
				t.Fatal("health responses must be JSON and not cached")
			}
		})
	}
}

func TestHealthRespectsRequestCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	handler := NewHandler(pingFunc(func(ctx context.Context) error {
		if ctx.Err() != context.Canceled {
			t.Fatal("request cancellation did not reach database check")
		}
		return ctx.Err()
	}), "http://localhost:8000")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health", nil).WithContext(ctx))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("got status %d", response.Code)
	}
}

func TestHealthRoutingAndCORS(t *testing.T) {
	for _, tc := range []struct {
		name, method, path, origin string
		code                       int
		allowOrigin                string
	}{
		{"allowed origin", "GET", "/health", "http://localhost:8000", 200, "http://localhost:8000"},
		{"other origin", "GET", "/health", "https://other.example", 200, ""},
		{"preflight", "OPTIONS", "/health", "http://localhost:8000", 204, "http://localhost:8000"},
		{"unsupported method", "POST", "/health", "", 405, ""},
		{"unknown route", "GET", "/missing", "", 404, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler := NewHandler(pingFunc(func(context.Context) error {
				if tc.method != "GET" || tc.path != "/health" {
					t.Fatal("unexpected database check")
				}
				return nil
			}), "http://localhost:8000")
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.Header.Set("Origin", tc.origin)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			if response.Code != tc.code || response.Header().Get("Access-Control-Allow-Origin") != tc.allowOrigin {
				t.Fatalf("got status %d, allowed origin %q", response.Code, response.Header().Get("Access-Control-Allow-Origin"))
			}
		})
	}
}
