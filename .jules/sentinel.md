## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-06-04 - TOCTOU SSRF and Open Redirect in Cover Downsloader
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint suffered from Server-Side Request Forgery (SSRF) and an Open Redirect via `req.query.url`. Attackers could bypass basic domain filtering if a DNS record updated its resolved IP to an internal address after validation but before Axios fetched it (TOCTOU). Furthermore, the catch block used a naive fallback `res.redirect(originalUrl)`, allowing SSRF bypasses via client-side redirection to local network resources.
**Learning:** URL string validation alone is insufficient against advanced SSRF attacks. Node.js `dns.lookup` caching behaviors and external redirects (`302`) easily bypass application-layer checks. Failed requests shouldn't default to trusting attacker-controlled input.
**Prevention:**
1. Re-route DNS resolution through custom `http.Agent`/`https.Agent` using an overridden `lookup` function that dynamically checks IPs against private ranges immediately prior to socket connection.
2. Set Axios `maxRedirects: 0` to block external redirects to internal resources.
3. Never use `res.redirect()` as an error fallback for user-supplied external URLs.
