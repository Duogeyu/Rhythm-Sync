## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-05-10 - SSRF and TOCTOU DNS Rebinding in Covers Proxy
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint fetched user-provided external URLs directly via `axios.get(req.query.url)` without validating the protocol or domain, allowing arbitrary HTTP requests to internal IP addresses (SSRF).
**Learning:** Directly fetching URLs allows attackers to port scan internal networks, reach internal services, or read cloud metadata. A simple DNS resolution check is insufficient on its own due to TOCTOU (Time-of-Check to Time-of-Use) DNS rebinding attacks, where the DNS record changes between validation and execution.
**Prevention:** Always validate external URLs and IP addresses to block private ranges. Mitigate TOCTOU DNS rebinding by substituting the resolved IP directly into the HTTP client's request URL (while preserving the `Host` header and configuring SNI) and setting `maxRedirects: 0` to block redirect bypasses.
