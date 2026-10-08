package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/events"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
	"github.com/pittcsc/pittcsc-website/backend/internal/roles"
	"github.com/pittcsc/pittcsc-website/backend/internal/server"
)

func main() {
	if err := run(); err != nil {
		slog.Error("API stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	// Local convenience only: deployed environments can supply variables directly.
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return errors.New("could not load backend/.env; check its syntax and permissions")
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errors.New("DATABASE_URL is required; configure backend/.env or the environment")
	}
	port := envOr("PORT", "8080")
	host := envOr("HOST", "127.0.0.1")
	frontendOrigin := envOr("FRONTEND_ORIGIN", "http://localhost:8000")
	if err := validateFrontendOrigin(host, frontendOrigin); err != nil {
		return err
	}
	portNumber, err := strconv.Atoi(port)
	if err != nil || portNumber < 1 || portNumber > 65535 {
		return errors.New("PORT must be an integer between 1 and 65535")
	}

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		// Driver parse errors may contain the connection string and its credentials.
		return errors.New("invalid DATABASE_URL; check the server configuration")
	}
	poolConfig.MaxConns = 5
	poolConfig.ConnConfig.ConnectTimeout = 2 * time.Second
	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return errors.New("could not initialize the database connection pool")
	}
	defer pool.Close()

	var calendar events.Calendar
	switch envOr("GOOGLE_CALENDAR_MODE", "disabled") {
	case "disabled":
	case "google":
		calendar, err = events.NewGoogle()
		if err != nil {
			return err
		}
	default:
		return errors.New("GOOGLE_CALENDAR_MODE must be disabled or google")
	}
	eventStore := events.Store{DB: pool, Calendar: calendar, CalendarID: envOr("GOOGLE_CALENDAR_ID", events.ClubCalendarID)}

	// A local default keeps existing local env files usable without rewriting them.
	verifier, err := auth.NewVerifier(envOr("SUPABASE_AUTH_URL", "http://127.0.0.1:54321/auth/v1"), auth.PostgresSessions{DB: pool})
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	api := &http.Server{
		Addr:              net.JoinHostPort(host, port),
		Handler:           server.NewHandler(pool, frontendOrigin, verifier, profile.Store{DB: pool}, roles.Store{DB: pool}, eventStore),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("API starting", "address", api.Addr)
		serverErrors <- api.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("HTTP server: %w", err)
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := api.Shutdown(shutdownCtx); err != nil {
			_ = api.Close()
			return fmt.Errorf("HTTP shutdown: %w", err)
		}
	}
	return nil
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func validateFrontendOrigin(bindHost, origin string) error {
	u, err := url.Parse(origin)
	if err != nil || u.Hostname() == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" ||
		(u.Scheme != "http" && u.Scheme != "https") {
		return errors.New("FRONTEND_ORIGIN must be an HTTP(S) origin without a path")
	}
	localBind := bindHost == "127.0.0.1" || bindHost == "localhost" || bindHost == "::1"
	hostname := strings.ToLower(u.Hostname())
	ip := net.ParseIP(hostname)
	if !localBind && (u.Scheme != "https" || hostname == "localhost" || strings.HasSuffix(hostname, ".localhost") ||
		(ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified()))) {
		return errors.New("hosted FRONTEND_ORIGIN must be a public HTTPS origin")
	}
	return nil
}
