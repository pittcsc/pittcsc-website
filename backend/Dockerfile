FROM golang:1.26.2-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/api ./cmd/api && \
    CGO_ENABLED=0 go build -trimpath -o /out/campaign-worker ./cmd/campaign-worker

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
COPY --from=build /out/campaign-worker /campaign-worker
ENV HOST=0.0.0.0
EXPOSE 8080
ENTRYPOINT ["/api"]
