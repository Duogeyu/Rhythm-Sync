## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2024-05-24 - SSRF Mitigation via HTTP Agents
**Vulnerability:** Server-Side Request Forgery (SSRF) and Open Redirect in cover downloading logic (`/api/covers/`).
**Learning:** Using `maxRedirects: 0` natively on Axios as an SSRF mitigation strategy breaks valid redirect flows (e.g., HTTP to HTTPS or CDN routing), and reinstantiating `http.Agent` per request ruins Keep-Alive pooling. The `safeLookup` approach is robust if the IPv6 `::` (unspecified) and `fe80::/10` (link-local) are also explicitly blocked alongside IPv4.
**Prevention:** Use a globally instantiated `http.Agent` and `https.Agent` with `keepAlive: true` and inject a comprehensive `dns.lookup` hook that intercepts and validates both IPv4 and IPv6 addresses. Replace fallback `res.redirect()` in proxy endpoints with a `500` error to prevent open redirect vulnerabilities.
