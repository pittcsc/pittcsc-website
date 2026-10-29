package profile

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/jpeg"
	"image/png"
	"testing"
)

func TestAvatarContentValidation(t *testing.T) {
	for _, format := range []string{"png", "jpeg", "webp"} {
		t.Run(format, func(t *testing.T) {
			var input bytes.Buffer
			if format == "png" {
				_ = png.Encode(&input, image.NewRGBA(image.Rect(0, 0, 2, 2)))
			}
			if format == "jpeg" {
				_ = jpeg.Encode(&input, image.NewRGBA(image.Rect(0, 0, 2, 2)), nil)
			}
			if format == "webp" {
				data, err := base64.StdEncoding.DecodeString("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA")
				if err != nil {
					t.Fatal(err)
				}
				input.Write(data)
			}
			input.WriteString("untrusted trailing metadata")
			media, data, err := PrepareAsset("avatar", input.Bytes())
			if err != nil {
				t.Fatal(err)
			}
			if media != "image/png" && media != "image/jpeg" {
				t.Fatalf("media = %s", media)
			}
			if bytes.Contains(data, []byte("untrusted trailing metadata")) {
				t.Fatal("metadata retained")
			}
		})
	}
	for _, input := range [][]byte{nil, []byte("<svg/>"), []byte("GIF89a"), []byte("\x89PNG\r\n\x1a\ncorrupt"), []byte("%PDF-1.4\n%%EOF")} {
		if _, _, err := PrepareAsset("avatar", input); err == nil {
			t.Fatal("invalid image accepted")
		}
	}
	var oversized bytes.Buffer
	_ = png.Encode(&oversized, image.NewRGBA(image.Rect(0, 0, 4097, 1)))
	if _, _, err := PrepareAsset("avatar", oversized.Bytes()); err == nil {
		t.Fatal("oversized dimensions accepted")
	}
	if _, _, err := PrepareAsset("avatar", make([]byte, AvatarLimit+1)); err != ErrFileTooLarge {
		t.Fatal("avatar byte limit ignored")
	}
}

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
	if _, _, err := PrepareAsset("other", data); err != ErrInvalidFile {
		t.Fatal("unknown asset kind accepted")
	}
}
