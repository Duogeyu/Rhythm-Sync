## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-05-27 - Server-Side Request Forgery via Image Proxies
**Vulnerability:** The `/api/covers/:gameId/:fileName` proxy endpoint, and related caching logic, used `req.query.url` directly in `axios.get()` without checking if the URL resolved to an internal IP. Additionally, the error handler fell back to `res.redirect(originalUrl)` which created an Open Redirect.
**Learning:** `axios` will follow redirects and resolve internal IP addresses for standard hostnames by default, allowing attackers to scan internal networks or access metadata services via the proxy endpoint. Error handlers that attempt to gracefully fail by redirecting to the unvalidated URL accidentally preserve SSRF and Open Redirect vectors.
**Prevention:** Implement an asynchronous preemptive DNS lookup (`dns.promises.lookup`) to validate the resolved IP against an internal IP blocklist (including `0.0.0.0`, `127.x.x.x`, `169.254.x.x`, etc.) before making the request. To prevent TOCTOU DNS rebinding, inject a custom `lookup` function into the `http.Agent`/`https.Agent` passed to `axios` so that the connection strictly uses the already-validated IP address.
