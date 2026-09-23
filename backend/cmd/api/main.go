package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
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

	// A local default keeps existing local env files usable without rewriting them.
	verifier, err := auth.NewVerifier(envOr("SUPABASE_AUTH_URL", "http://127.0.0.1:54321/auth/v1"), auth.PostgresSessions{DB: pool})
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	api := &http.Server{
		Addr:              net.JoinHostPort(envOr("HOST", "127.0.0.1"), port),
		Handler:           server.NewHandler(pool, envOr("FRONTEND_ORIGIN", "http://localhost:8000"), verifier),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
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
