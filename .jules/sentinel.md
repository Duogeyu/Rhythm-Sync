## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-04-20 - SSRF and Open Redirect in Proxy Endpoints
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint fetched unvalidated user-controlled URLs and fell back to `res.redirect()` on failure, creating both SSRF (via internal IP access) and Open Redirect vulnerabilities.
**Learning:** External proxy endpoints must validate URLs against a strict allowlist (or blocklist of internal IPs like 127.0.0.1, 169.254.x.x) and use custom DNS resolution logic (`httpAgent`/`httpsAgent`) to prevent DNS rebinding attacks. Error handlers should never fallback to redirecting to the unvalidated target.
**Prevention:** Implement an `isSafeUrl` check and pass a centralized `safeLookup` agent to all HTTP clients (`axios`, `fetch`) fetching user-provided URLs.
