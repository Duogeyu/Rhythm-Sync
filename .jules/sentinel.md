## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-04-21 - [SSRF Bypass via Missing IPv6 Loopback Brackets]
**Vulnerability:** A custom string-based URL filter (`isValidExternalUrl`) intended to block SSRF requests failed to intercept IPv6 loopback addresses because it checked for `::1` instead of `[::1]`.
**Learning:** `new URL()` in Node.js returns the hostname of an explicit IPv6 address wrapped in brackets (e.g. `[::1]`). Standard string equality checks that ignore these brackets will silently fail to block the traffic.
**Prevention:** When validating URLs against internal IP ranges using `URL.hostname`, explicitly account for bracketed IPv6 syntax.
