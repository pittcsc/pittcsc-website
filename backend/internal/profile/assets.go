package profile

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"time"
)

type Asset struct {
	MediaType string
	Bytes     []byte
	UpdatedAt time.Time
}

func (s Store) PutAsset(ctx context.Context, authUserID, kind, mediaType string, data []byte) error {
	if kind != "resume" {
		return ErrInvalidFile
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var status string
	err = tx.QueryRow(ctx, `select account_status from csc.profiles where auth_user_id = $1::uuid for update`, authUserID).Scan(&status)
	if err != nil {
		return err
	}
	if status != "active" {
		return ErrSuspended
	}
	var id string
	err = tx.QueryRow(ctx, `
		insert into csc.profile_assets (auth_user_id, kind, media_type, bytes)
		values ($1::uuid, $2, $3, $4)
		on conflict (auth_user_id, kind) do update set media_type = excluded.media_type,
		  bytes = excluded.bytes, updated_at = now()
		returning id::text
	`, authUserID, kind, mediaType, data).Scan(&id)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `update csc.profiles set resume_asset_id = $2::uuid, updated_at = now() where auth_user_id = $1::uuid`, authUserID, id)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s Store) GetAsset(ctx context.Context, authUserID, kind string) (Asset, error) {
	if kind != "resume" {
		return Asset{}, ErrInvalidFile
	}
	var asset Asset
	err := s.DB.QueryRow(ctx, `
		select a.media_type, a.bytes, a.updated_at from csc.profile_assets a
		join csc.profiles p on p.auth_user_id = a.auth_user_id
		where a.auth_user_id = $1::uuid and a.kind = $2 and p.account_status = 'active'
	`, authUserID, kind).Scan(&asset.MediaType, &asset.Bytes, &asset.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrNotFound
	}
	return asset, err
}

func (s Store) DeleteAsset(ctx context.Context, authUserID, kind string) error {
	if kind != "resume" {
		return ErrInvalidFile
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var status string
	err = tx.QueryRow(ctx, `select account_status from csc.profiles where auth_user_id = $1::uuid for update`, authUserID).Scan(&status)
	if err != nil {
		return err
	}
	if status != "active" {
		return ErrSuspended
	}
	_, err = tx.Exec(ctx, `update csc.profiles set resume_asset_id = null, updated_at = now() where auth_user_id = $1::uuid`, authUserID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `delete from csc.profile_assets where auth_user_id = $1::uuid and kind = $2`, authUserID, kind)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
