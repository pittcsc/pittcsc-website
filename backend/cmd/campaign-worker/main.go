// campaign-worker runs due work once; invoke periodically with a job scheduler.
package main

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/pittcsc/pittcsc-website/backend/internal/campaigns"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
)

func main() {
	if e := run(); e != nil {
		slog.Error("Campaign worker stopped; inspect configuration or delivery state", "error", e)
		os.Exit(1)
	}
}
func run() error {
	if e := godotenv.Load(); e != nil && !errors.Is(e, os.ErrNotExist) {
		return errors.New("could not load backend environment")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg, e := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if e != nil {
		return errors.New("invalid database configuration")
	}
	cfg.MaxConns = 3
	cfg.ConnConfig.ConnectTimeout = 5 * time.Second
	pool, e := pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		return errors.New("database unavailable")
	}
	defer pool.Close()
	transport, e := campaigns.NewTransport(ctx)
	if e != nil {
		return e
	}
	public := os.Getenv("CAMPAIGN_PUBLIC_URL")
	if public == "" {
		public = "http://localhost:8080"
	}
	if e = campaigns.ValidatePublicURL(public, os.Getenv("CAMPAIGN_MAIL_MODE")); e != nil {
		return e
	}
	rate := 1
	if raw := os.Getenv("CAMPAIGN_MESSAGES_PER_SECOND"); raw != "" {
		rate, e = strconv.Atoi(raw)
		if e != nil || rate < 1 || rate > 50 {
			return errors.New("CAMPAIGN_MESSAGES_PER_SECOND must be 1–50 and within SES quota")
		}
	}
	s := campaigns.Store{DB: pool, Transport: transport, PublicURL: public}
	return s.Run(ctx, 5000, time.Second/time.Duration(rate))
}
