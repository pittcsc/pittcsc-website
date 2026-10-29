// Package roles owns the role policy, member search, and audited role changes.
// GrantStaff is the operator-only bootstrap; dashboard changes use Store.Change.
package roles

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrIneligible = errors.New("no eligible account; the user must sign in and open the dashboard first, and the account must be active")
var ErrInvalid = errors.New("provide a Pitt email and an operator label of 1–200 characters without control characters")
var pittEmail = regexp.MustCompile(`^[^@\s]+@pitt\.edu$`)

func Validate(email, operator string) (string, string, error) {
	email, operator = strings.ToLower(strings.TrimSpace(email)), strings.TrimSpace(operator)
	if !pittEmail.MatchString(email) || !utf8.ValidString(operator) || utf8.RuneCountInString(operator) < 1 || utf8.RuneCountInString(operator) > 200 || strings.ContainsFunc(operator, unicode.IsControl) {
		return "", "", ErrInvalid
	}
	return email, operator, nil
}

// GrantStaff adds staff while preserving every existing assignment. Locking the
// profile serializes concurrent grants; the audit and assignment commit together.
func GrantStaff(ctx context.Context, db *pgxpool.Pool, email, operator string) (bool, error) {
	email, operator, err := Validate(email, operator)
	if err != nil {
		return false, err
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	var id string
	err = tx.QueryRow(ctx, `
		select p.auth_user_id::text from csc.profiles p
		join auth.users u on u.id = p.auth_user_id
		where lower(u.email) = $1 and `+eligible+`
		for update of p
	`, email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrIneligible
	}
	if err != nil {
		return false, err
	}
	result, err := tx.Exec(ctx, `insert into csc.user_roles (auth_user_id, role) values ($1::uuid, 'staff') on conflict do nothing`, id)
	if err != nil {
		return false, err
	}
	changed := result.RowsAffected() == 1
	if changed {
		_, err = tx.Exec(ctx, `insert into csc.role_audit (target_user_id, role, action, operator) values ($1::uuid, 'staff', 'grant', $2)`, id, operator)
		if err != nil {
			return false, err
		}
	}
	return changed, tx.Commit(ctx)
}
