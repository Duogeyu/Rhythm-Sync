## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-05-07 - SSRF and TOCTOU Protection in Download Proxies
**Vulnerability:** The `/api/covers/` endpoint downloaded remote images based on user input `req.query.url` using `axios.get()` without checking if the URL resolved to an internal, private network IP address, leading to Server-Side Request Forgery (SSRF).
**Learning:** `axios.get` alone is not safe when fetching user-provided URLs. SSRF protection must resolve the DNS record first to ensure the IP isn't private. Furthermore, to prevent Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks, the actual download request must be made directly to the resolved safe IP address, while overriding the `Host` header (and `servername` for HTTPS/SNI) to mimic the original request.
**Prevention:** Always use a helper like `isValidExternalUrl` that performs DNS resolution and returns the safe IP to use. Additionally, ensure `maxRedirects: 0` is set in the HTTP client to prevent malicious servers from bypassing the check via 301/302 redirects.
