## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-04-20 - SSRF and Open Redirect in axios image downloader
**Vulnerability:** The proxy endpoints `downloadAndCacheCover` and `/api/covers/:gameId/:fileName` take an `originalUrl` and pass it directly to `axios.get()` without checking if the URL points to an internal IP address (SSRF). Additionally, on failure, it executes `res.redirect(originalUrl)`, leading to an Open Redirect that can also serve as an SSRF proxy bypassing client-side restrictions.
**Learning:** External fetch requests via `axios` will faithfully fetch any internal IP address unless explicitly blocked. Simple regex matching is susceptible to TOCTOU DNS rebinding. Setting `maxRedirects: 0` is required to avoid SSRF via 302 redirects.
**Prevention:** Always use `isInternalIp` in conjunction with a custom `httpAgent` / `httpsAgent` `lookup` function to enforce IP filtering dynamically. Remove `res.redirect()` fallbacks for proxy downloads.
