## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2025-02-28 - SSRF DNS Rebinding & Loopback TOCTOU Fixes
**Vulnerability:** External user URLs fetched via `axios` were vulnerable to SSRF and TOCTOU DNS rebinding, and standard `localhost` IP checking was bypassable via `0.0.0.0` or `127.x.x.x`.
**Learning:** `dns.lookup` validation alone is useless against DNS rebinding if `axios` resolves the domain *again* inside its connection phase. Furthermore, `127.0.0.1` checks are insufficient because `127.0.0.0/8` and `0.0.0.0` map to localhost.
**Prevention:** 1. Check `0.0.0.0` and the whole `127.` block. 2. To fix TOCTOU in `axios`, return the resolved IP from the validation phase, override the target URL's hostname with this IP, provide the original Hostname in the `Host` header, specify `servername` in a custom `httpsAgent`, and specify `maxRedirects: 0` to block redirect bypasses.
