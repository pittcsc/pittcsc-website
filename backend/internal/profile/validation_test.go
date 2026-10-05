package profile

import (
	"bytes"
	"context"
	"testing"
)

func TestResumeContentValidation(t *testing.T) {
	data := []byte("%PDF-1.4\nfixture\n%%EOF\n")
	media, actual, err := PrepareAsset("resume", data)
	if err != nil || media != "application/pdf" || !bytes.Equal(actual, data) {
		t.Fatal("PDF rejected or altered")
	}
	for _, input := range [][]byte{nil, []byte("not PDF"), []byte("%PDF-1.4 truncated")} {
		if _, _, err := PrepareAsset("resume", input); err == nil {
			t.Fatal("invalid resume accepted")
		}
	}
	if _, _, err := PrepareAsset("resume", make([]byte, ResumeLimit+1)); err != ErrFileTooLarge {
		t.Fatal("resume byte limit ignored")
	}
	if _, _, err := PrepareAsset("avatar", data); err != ErrInvalidFile {
		t.Fatal("removed image asset kind accepted")
	}
}

func TestStoreRejectsUnsupportedAssetKinds(t *testing.T) {
	store := Store{}
	ctx := context.Background()
	for _, kind := range []string{"avatar", "other"} {
		if err := store.PutAsset(ctx, "owner", kind, "image/png", nil); err != ErrInvalidFile {
			t.Fatal("unsupported upload reached the database")
		}
		if _, err := store.GetAsset(ctx, "owner", kind); err != ErrInvalidFile {
			t.Fatal("unsupported download reached the database")
		}
		if err := store.DeleteAsset(ctx, "owner", kind); err != ErrInvalidFile {
			t.Fatal("unsupported removal reached the database")
		}
	}
}
