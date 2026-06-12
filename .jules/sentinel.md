## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-04-20 - Unvalidated External Requests & DNS Rebinding (SSRF)
**Vulnerability:** External HTTP requests via `axios.get` in `downloadAndCacheCover` and `/api/covers/:gameId/:fileName` rely on user-controlled `originalUrl` query parameters. This allows attackers to access internal network services (SSRF) or use Open Redirect in the catch block to bypass protections.
**Learning:** Checking for internal IPs is not enough if DNS resolution changes between the check and the actual fetch (TOCTOU/DNS Rebinding). Node.js HTTP clients must use a custom DNS lookup that explicitly blocks internal IPs before connection.
**Prevention:** Implement `isSafeUrl` to drop internal IP payloads early. More importantly, create and use custom `http.Agent` and `https.Agent` singletons using a custom `lookup` function that strictly rejects resolution to internal RFC1918/Loopback addresses before the connection is established. Always remove explicit `res.redirect(originalUrl)` fallbacks from error handlers in proxy endpoints.
