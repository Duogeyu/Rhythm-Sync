## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2025-02-28 - SSRF and Open Redirect in Proxy Endpoints
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint fetched external images based on user-supplied `req.query.url` and used `res.redirect(originalUrl)` on download failures.
**Learning:** Proxy endpoints and external downloaders in Node.js need strict protocol checks and robust DNS Rebinding protection (using a custom `dns.lookup` for Axios agents) to prevent them from hitting internal metadata endpoints (169.254.x.x) or private networks. Furthermore, redirecting to an unvalidated URL on error preserves an Open Redirect vulnerability.
**Prevention:** Implement `isSafeUrl()` to block local IPs at parse time, construct shared `httpAgent` and `httpsAgent` singletons using a custom `safeLookup` function that blocks internal resolved IPs, and use `res.status(500)` rather than `res.redirect()` upon fetch errors.
