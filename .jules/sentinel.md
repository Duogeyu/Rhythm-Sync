## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-04-20 - SSRF and TOCTOU DNS Rebinding Prevention
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint directly used `req.query.url` in `axios.get` without SSRF validation.
**Learning:** `axios` will natively follow redirects and follow DNS responses at the time of use, making simple regex URL validation bypassable via DNS rebinding (TOCTOU) and open redirectors.
**Prevention:** 1) Resolve the IP before fetching (`dns.promises.lookup`), 2) Reject internal/private IPs (IPv4 & IPv6), 3) Directly request the resolved IP rather than the hostname, and 4) Override `Host` and `httpsAgent` to preserve SNI/VHost behavior, while setting `maxRedirects: 0` and manually following redirects to re-validate IPs recursively.
