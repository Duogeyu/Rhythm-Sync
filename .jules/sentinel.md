## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-04-21 - SSRF via Cover Proxy/Download Endpoints
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint and `downloadAndCacheCover` function allowed user-controlled URLs (`originalUrl`) to be directly requested via `axios.get` without prior validation.
**Learning:** This exposes the server to SSRF and TOCTOU DNS rebinding attacks. Attackers could probe internal networks, access metadata services (169.254.x.x), or bypass simple URL validations by changing the DNS resolution of an attacker-controlled domain after the initial check.
**Prevention:** Always validate `originalUrl` protocol and hostname using `isSafeUrl()`. Critically, supply customized `httpAgent` and `httpsAgent` configurations to `axios.get` that wrap `dns.lookup` to perform active validation against internal IP addresses (e.g., `127.0.0.1`, `10.x.x.x`, `192.168.x.x`) immediately during the connection phase, and enforce `maxRedirects: 0` to prevent redirect-based bypasses.
