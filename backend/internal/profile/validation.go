package profile

import (
	"bytes"
	"errors"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"

	_ "golang.org/x/image/webp"
)

const (
	AvatarLimit = 5 * 1024 * 1024
	ResumeLimit = 10 * 1024 * 1024
)

var (
	ErrFileTooLarge = errors.New("file too large")
	ErrInvalidFile  = errors.New("invalid file")
)

// PrepareAsset validates actual content, not extensions or client MIME claims.
// Avatars are decoded and re-encoded to strip metadata and trailing payloads.
// PDFs remain downloads; signature validation does not claim malware scanning.
func PrepareAsset(kind string, data []byte) (string, []byte, error) {
	limit := AvatarLimit
	if kind == "resume" {
		limit = ResumeLimit
	} else if kind != "avatar" {
		return "", nil, ErrInvalidFile
	}
	if len(data) > limit {
		return "", nil, ErrFileTooLarge
	}
	if len(data) == 0 {
		return "", nil, ErrInvalidFile
	}
	if kind == "resume" {
		if !bytes.HasPrefix(data, []byte("%PDF-")) || !bytes.HasSuffix(bytes.TrimSpace(data), []byte("%%EOF")) {
			return "", nil, ErrInvalidFile
		}
		return "application/pdf", data, nil
	}
	media := http.DetectContentType(data)
	if media != "image/jpeg" && media != "image/png" && media != "image/webp" {
		return "", nil, ErrInvalidFile
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width > 4096 || config.Height > 4096 || config.Width*config.Height > 16_000_000 {
		return "", nil, ErrInvalidFile
	}
	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", nil, ErrInvalidFile
	}
	var output bytes.Buffer
	if media == "image/jpeg" {
		err = jpeg.Encode(&output, decoded, &jpeg.Options{Quality: 90})
	} else {
		media = "image/png"
		err = png.Encode(&output, decoded)
	}
	if err != nil {
		return "", nil, ErrInvalidFile
	}
	if output.Len() > AvatarLimit {
		return "", nil, ErrFileTooLarge
	}
	return media, output.Bytes(), nil
}
