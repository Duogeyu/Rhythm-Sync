## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-06-27 - SSRF and Open Redirect in Proxy Endpoints
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint and `downloadAndCacheCover` functions passed user-controlled URLs directly to `axios.get` without validation, leading to SSRF. Furthermore, the endpoint's error handler included an open redirect fallback (`res.redirect(originalUrl)`).
**Learning:** Direct fetch of user input requires strict validation of the parsed URL to ensure it points to an external resource and the usage of a custom HTTP/HTTPS agent that wraps `dns.lookup` to prevent DNS rebinding attacks.
**Prevention:** Utilize `net.isIP()` and CIDR blocklists (e.g., `127.`, `10.`, `192.168.`, `169.254.`) to validate parsed URLs, and inject custom `dns.lookup` agents into HTTP clients to validate resolved IPs prior to socket connection. Never redirect to unvalidated URLs in error handlers.
