package profile

import (
	"bytes"
	"errors"
)

const ResumeLimit = 10 * 1024 * 1024

var (
	ErrFileTooLarge = errors.New("file too large")
	ErrInvalidFile  = errors.New("invalid file")
)

// PrepareAsset validates actual content, not extensions or client MIME claims.
// PDFs remain downloads; signature validation does not claim malware scanning.
func PrepareAsset(kind string, data []byte) (string, []byte, error) {
	if kind != "resume" {
		return "", nil, ErrInvalidFile
	}
	if len(data) > ResumeLimit {
		return "", nil, ErrFileTooLarge
	}
	if !bytes.HasPrefix(data, []byte("%PDF-")) || !bytes.HasSuffix(bytes.TrimSpace(data), []byte("%%EOF")) {
		return "", nil, ErrInvalidFile
	}
	return "application/pdf", data, nil
}
