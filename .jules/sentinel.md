## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2025-05-16 - SSRF and DNS Rebinding via Axios Download
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint directly requested user-supplied cover URLs using `axios.get()` without resolving DNS or blocking private IPs.
**Learning:** This exposes the application to SSRF (Server-Side Request Forgery) via internal service discovery or cloud metadata queries. Moreover, a naive HTTP check combined with `axios` would still fall victim to TOCTOU DNS rebinding.
**Prevention:** Implement an `isValidExternalUrl` utility function that explicitly resolves the host using `dns.promises.lookup`, blocks internal subnets (`127.x.x.x`, `10.x.x.x`, `fc00::/7`), and replaces the requested URL host with the resolved IP while preserving the original `Host` header (`httpsAgent: new https.Agent({ servername })` for SNI) and disabling redirects (`maxRedirects: 0`).
