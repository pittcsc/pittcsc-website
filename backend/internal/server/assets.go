package server

import (
	"context"
	"errors"
	"io"
	"mime"
	"net/http"
	"time"

	"github.com/pittcsc/pittcsc-website/backend/internal/auth"
	"github.com/pittcsc/pittcsc-website/backend/internal/profile"
)

type assetStore interface {
	PutAsset(context.Context, string, string, string, []byte) error
	GetAsset(context.Context, string, string) (profile.Asset, error)
	DeleteAsset(context.Context, string, string) error
}

func registerAssetRoutes(mux *http.ServeMux, authentication authenticator, profiles profileStore) {
	assets, ok := profiles.(assetStore)
	for _, kind := range []string{"avatar", "resume"} {
		path := "/profile/" + kind
		handler := withProfile(authentication, profiles, 25*time.Second, func(w http.ResponseWriter, r *http.Request, identity auth.Identity, _ profile.Record) {
			if !ok {
				writeProfileError(w, auth.ErrUnavailable)
				return
			}
			switch r.Method {
			case http.MethodGet:
				asset, err := assets.GetAsset(r.Context(), identity.ID, kind)
				if err != nil {
					writeProfileError(w, err)
					return
				}
				w.Header().Set("Content-Type", asset.MediaType)
				w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
				w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
				if kind == "resume" {
					w.Header().Set("Content-Disposition", `attachment; filename="resume.pdf"`)
				}
				_, _ = w.Write(asset.Bytes)
			case http.MethodPut:
				media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
				allowed := media == "application/octet-stream" || (kind == "resume" && media == "application/pdf") || (kind == "avatar" && (media == "image/jpeg" || media == "image/png" || media == "image/webp"))
				if err != nil || !allowed {
					writeJSONError(w, http.StatusUnsupportedMediaType, "Choose a PDF resume or a JPEG, PNG, or WebP avatar.")
					return
				}
				limit := int64(profile.AvatarLimit)
				if kind == "resume" {
					limit = profile.ResumeLimit
				}
				r.Body = http.MaxBytesReader(w, r.Body, limit)
				data, err := io.ReadAll(r.Body)
				if err != nil {
					var tooLarge *http.MaxBytesError
					if errors.As(err, &tooLarge) {
						writeProfileError(w, profile.ErrFileTooLarge)
					} else {
						writeJSONError(w, http.StatusBadRequest, "The upload could not be read. Try again.")
					}
					return
				}
				media, data, err = profile.PrepareAsset(kind, data)
				if err != nil {
					writeProfileError(w, err)
					return
				}
				if err := assets.PutAsset(r.Context(), identity.ID, kind, media, data); err != nil {
					writeProfileError(w, err)
					return
				}
				w.WriteHeader(http.StatusNoContent)
			case http.MethodDelete:
				if err := assets.DeleteAsset(r.Context(), identity.ID, kind); err != nil {
					writeProfileError(w, err)
					return
				}
				w.WriteHeader(http.StatusNoContent)
			}
		})
		for _, method := range []string{"GET", "PUT", "DELETE"} {
			mux.HandleFunc(method+" "+path, handler)
		}
		mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	}
}
