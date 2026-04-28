## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-05-20 - Unrestricted External URL Fetching (SSRF)
**Vulnerability:** External URLs provided via `req.query.url` or external API responses (`song.coverUrl`) were directly fetched using `axios.get()` without validating their safety, allowing a Server-Side Request Forgery (SSRF) attack. An attacker could force the server to scan internal networks, hit loopback interfaces, or fetch arbitrary internal resources.
**Learning:** Never trust externally provided URLs for backend fetching. Even if the parameter is named "url" or "coverUrl", it could be malicious like `http://127.0.0.1:3002/admin/clear-cache` or point to a local service.
**Prevention:** Always parse and validate external URLs using a dedicated asynchronous validator (like `isValidExternalUrl` which uses `dns.promises.lookup` to check resolved IPs against a blocklist of private, loopback, and link-local addresses) before passing them to fetch functions like `axios.get()`.
