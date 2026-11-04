package campaigns

import (
	"context"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
	"time"
)

type Asset struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Store) Assets(ctx context.Context) ([]Asset, error) {
	rows, e := s.DB.Query(ctx, `select id::text,name,created_at from csc.email_assets order by created_at desc`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Asset{}
	for rows.Next() {
		var a Asset
		if e = rows.Scan(&a.ID, &a.Name, &a.CreatedAt); e != nil {
			return nil, e
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
func (s *Store) Upload(ctx context.Context, actor, name string, data []byte) (Asset, error) {
	if name == "" || !validText(name, 200, false) {
		return Asset{}, ErrInvalid
	}
	media, data, e := profile.ReencodeImage(data, 5*1024*1024)
	if e != nil {
		return Asset{}, ErrInvalid
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return Asset{}, e
	}
	defer tx.Rollback(ctx)
	a := Asset{Name: name}
	e = tx.QueryRow(ctx, `insert into csc.email_assets(name,media_type,bytes,created_by) values($1,$2,$3,$4::uuid) returning id::text,created_at`, name, media, data, actor).Scan(&a.ID, &a.CreatedAt)
	if e != nil {
		return a, e
	}
	return a, tx.Commit(ctx)
}
func (s *Store) Asset(ctx context.Context, id string) (string, []byte, error) {
	if !ValidID(id) {
		return "", nil, ErrNotFound
	}
	var media string
	var data []byte
	e := s.DB.QueryRow(ctx, `select media_type,bytes from csc.email_assets where id=$1::uuid`, id).Scan(&media, &data)
	return media, data, dbError(e)
}
