// grant-staff is a trusted database-operator command, not an application API.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/pittcsc/pittcsc-website/backend/internal/roles"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	flags := flag.NewFlagSet("grant-staff", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	email := flags.String("email", "", "existing account's Pitt email")
	operator := flags.String("operator", "", "operator attribution for audit")
	if err := flags.Parse(args); err != nil || flags.NArg() != 0 {
		return errors.New("usage: grant-staff --email <pitt-email> --operator <operator-label>")
	}
	if _, _, err := roles.Validate(*email, *operator); err != nil {
		return err
	}
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return errors.New("could not load backend/.env")
	}
	if os.Getenv("DATABASE_URL") == "" {
		return errors.New("DATABASE_URL is required")
	}
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		return errors.New("invalid DATABASE_URL")
	}
	config.MaxConns = 1
	config.ConnConfig.ConnectTimeout = 3 * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return errors.New("could not initialize database connection")
	}
	defer db.Close()
	changed, err := roles.GrantStaff(ctx, db, *email, *operator)
	if errors.Is(err, roles.ErrIneligible) || errors.Is(err, roles.ErrInvalid) {
		return err
	}
	if err != nil {
		return errors.New("staff grant failed; verify database connectivity and migrations, then retry")
	}
	if changed {
		fmt.Println("Staff role granted; audit recorded.")
	} else {
		fmt.Println("Staff role already present; no change.")
	}
	return nil
}
