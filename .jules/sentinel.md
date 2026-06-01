## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-06-01 - Global Safe DNS Lookup and Private IP Validation for Axios SSRF
**Vulnerability:** Application fetches user-provided URLs in `axios.get()` (e.g. `req.query.url` for covers) without validating the destination, leading to Server-Side Request Forgery (SSRF) capable of hitting internal endpoints like `localhost`.
**Learning:** Using basic hostname checks is susceptible to TOCTOU (Time-of-Check to Time-of-Use) DNS rebinding and bypasses via IPv6 (e.g. `::`).
**Prevention:** Implement a secure DNS wrapper (`safeLookup`) that checks for all forms of private IP ranges, including `0.0.0.0` and IPv6 `::`. Pass this custom `lookup` via globally instantiated `http.Agent` and `https.Agent` directly into Axios requests.
