# Public tools

Behavior constraints for the accountless `/meet` scheduler and branded `/qr`
generator. See the [repository guide](REPOSITORY.md) for code locations and the
[development instructions](DEVELOPMENT.md#verification) for safe local testing.

## Meeting scheduler

Meetings cross candidate dates with daily windows in 30-minute slots. Slot digits
mean `0` unavailable, `1` if needed, and `2` available. Silence is never availability;
pending participants are distinct from submitted participants. Model, grids,
counts, and ranking must agree. Calendar dates are labels; slot instants are
projected into each viewer's timezone without moving the underlying instant.
Cover DST and midnight/date-line crossings when changing date/time logic.

Meeting links work without login. Browser-held participant IDs and name-conflict
confirmation allow convenience editing; they do not establish authenticated club
identity. Preserve duplicate-name confirmation rather than silently merging people.

Multiple ICS/Google imports combine busy intervals. Manual overrides survive
imports, and presets respect calendar conflicts. ICS parsing stays in the browser.
Google requests only free/busy scope, uses a transient token, and revokes it after
the request. Never upload raw calendars, event details, or tokens to our server.

The server stores derived availability. File writes use locks and atomic rename;
Upstash uses atomic compare-and-set. Preserve conflict retries across independent
processes. GET polling uses ETags and `no-store`; write/API errors must remain
visible and retryable. Production serverless deployments need Upstash credentials;
the local file adapter is intentionally reported as nondurable by health checks.

## QR generator

QR generation is separate from attendance. Preserve the center logo, quiet zone,
high error correction, PNG/SVG download behavior, and transparent vs white
backgrounds. Dynamically import its DOM/canvas library in the browser.
