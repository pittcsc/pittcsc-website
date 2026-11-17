package campaigns

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"io"
	"strconv"
	"strings"
)

type ImportInput struct {
	CSV     string         `json:"csv"`
	Mapping map[string]int `json:"mapping"`
}
type ImportRow struct {
	Row       int          `json:"row"`
	Input     ContactInput `json:"input"`
	Existing  *Contact     `json:"existing,omitempty"`
	Error     string       `json:"error,omitempty"`
	Conflicts []string     `json:"conflicts"`
}
type ImportPreview struct {
	ID        string      `json:"id"`
	Rows      []ImportRow `json:"rows"`
	Committed bool        `json:"committed"`
	Count     int         `json:"count"`
}

func ParseImport(in ImportInput) ([]ImportRow, error) {
	if len(in.CSV) > 2*1024*1024 {
		return nil, ErrInvalid
	}
	for _, f := range []string{"firstName", "lastName", "email"} {
		if _, ok := in.Mapping[f]; !ok {
			return nil, ErrInvalid
		}
	}
	r := csv.NewReader(strings.NewReader(strings.TrimPrefix(in.CSV, "\ufeff")))
	headers, e := r.Read()
	if e != nil || len(headers) > 100 {
		return nil, ErrInvalid
	}
	for _, i := range in.Mapping {
		if i < 0 || i >= len(headers) {
			return nil, ErrInvalid
		}
	}
	out := []ImportRow{}
	seen := map[string]bool{}
	for n := 2; ; n++ {
		row, e := r.Read()
		if e == io.EOF {
			break
		}
		if e != nil || n > 5001 {
			return nil, ErrInvalid
		}
		get := func(k string) string {
			if i, ok := in.Mapping[k]; ok {
				return strings.TrimSpace(row[i])
			}
			return ""
		}
		v := ContactInput{FirstName: get("firstName"), LastName: get("lastName"), Email: get("email"), Tags: strings.Split(get("tags"), ";"), Majors: strings.Split(get("major"), ";")}
		bad := ""
		if raw := get("graduationYear"); raw != "" {
			y, e := strconv.Atoi(raw)
			if e != nil {
				bad = "Invalid graduation year"
			} else {
				v.Year = &y
			}
		}
		if v.Validate() != nil || v.FirstName == "" || v.LastName == "" {
			bad = "Require first name, last name, valid email, and valid optional values"
		}
		if seen[v.Email] {
			bad = "Duplicate email in this file; merge into its first row or skip"
		}
		seen[v.Email] = true
		out = append(out, ImportRow{Row: n, Input: v, Error: bad, Conflicts: []string{}})
	}
	if len(out) == 0 {
		return nil, ErrInvalid
	}
	return out, nil
}
func (s *Store) PreviewImport(ctx context.Context, actor string, in ImportInput) (ImportPreview, error) {
	rows, e := ParseImport(in)
	if e != nil {
		return ImportPreview{}, e
	}
	contacts, e := s.Contacts(ctx)
	if e != nil {
		return ImportPreview{}, e
	}
	by := map[string]Contact{}
	for _, c := range contacts {
		by[c.Email] = c
	}
	for i := range rows {
		r := &rows[i]
		if c, ok := by[r.Input.Email]; ok {
			r.Existing = &c
			for _, f := range []struct{ n, a, b string }{{"firstName", c.FirstName, r.Input.FirstName}, {"lastName", c.LastName, r.Input.LastName}, {"majors", strings.Join(c.Majors, ";"), strings.Join(r.Input.Majors, ";")}} {
				if f.a != "" && f.b != "" && !strings.EqualFold(f.a, f.b) {
					r.Conflicts = append(r.Conflicts, f.n)
				}
			}
			if c.Year != nil && r.Input.Year != nil && *c.Year != *r.Input.Year {
				r.Conflicts = append(r.Conflicts, "graduationYear")
			}
		}
	}
	v := ImportPreview{Rows: rows}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return v, e
	}
	defer tx.Rollback(ctx)
	e = tx.QueryRow(ctx, `insert into csc.email_imports(actor_id,result) values($1::uuid,$2) returning id::text`, actor, jsonBytes(v)).Scan(&v.ID)
	if e != nil {
		return v, e
	}
	return v, tx.Commit(ctx)
}
func (s *Store) CommitImport(ctx context.Context, actor, id string, overwrite bool, skip []int) (ImportPreview, error) {
	if !ValidID(id) {
		return ImportPreview{}, ErrInvalid
	}
	tx, e := s.staffTx(ctx, actor)
	if e != nil {
		return ImportPreview{}, e
	}
	defer tx.Rollback(ctx)
	var data []byte
	e = tx.QueryRow(ctx, `select result from csc.email_imports where id=$1::uuid for update`, id).Scan(&data)
	if e != nil {
		return ImportPreview{}, dbError(e)
	}
	var v ImportPreview
	if e = json.Unmarshal(data, &v); e != nil {
		return v, e
	}
	v.ID = id
	if v.Committed {
		return v, nil
	}
	skips := map[int]bool{}
	for _, n := range skip {
		skips[n] = true
	}
	for _, row := range v.Rows {
		if row.Error != "" || skips[row.Row] {
			continue
		}
		in := row.Input
		if row.Existing == nil {
			tag, e := tx.Exec(ctx, `insert into csc.email_contacts(email,first_name,last_name,graduation_year,majors,tags) values($1,$2,$3,$4,$5,$6) on conflict(email) do nothing`, in.Email, in.FirstName, in.LastName, in.Year, in.Majors, in.Tags)
			if e != nil {
				return v, e
			}
			if tag.RowsAffected() != 1 {
				return v, ErrConflict
			}
		} else {
			c := row.Existing
			tag, e := tx.Exec(ctx, `update csc.email_contacts set first_name=case when auth_user_id is null and ($8 or first_name='') then $3 else first_name end,last_name=case when auth_user_id is null and ($8 or last_name='') then $4 else last_name end,graduation_year=case when auth_user_id is null and ($8 or graduation_year is null) then coalesce($5,graduation_year) else graduation_year end,majors=case when auth_user_id is null and cardinality($6::text[])>0 and ($8 or cardinality(majors)=0) then $6 else majors end,tags=array(select distinct t from unnest(tags || $7::text[]) t),version=version+1,updated_at=now() where id=$1::uuid and version=$2`, c.ID, c.Version, in.FirstName, in.LastName, in.Year, in.Majors, in.Tags, overwrite)
			if e != nil {
				return v, e
			}
			if tag.RowsAffected() != 1 {
				return v, ErrConflict
			}
		}
		v.Count++
	}
	v.Committed = true
	_, e = tx.Exec(ctx, `update csc.email_imports set result=$2 where id=$1::uuid`, id, jsonBytes(v))
	if e != nil {
		return v, e
	}
	return v, tx.Commit(ctx)
}
