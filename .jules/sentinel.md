## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-04-28 - [SSRF vulnerability when proxying cover URLs]
**Vulnerability:** A Server-Side Request Forgery (SSRF) risk existed because user-controlled `coverUrl` parameters were fetched by the server (e.g. `downloadAndCacheCover`, `/api/covers/:gameId/:fileName` query params) using `axios.get` without verifying if the URLs resolved to internal or protected IP addresses.
**Learning:** `axios` will faithfully execute requests to any URL provided (including `http://127.0.0.1` or `http://localhost`). Additionally, standard URL scheme checks are insufficient, as attackers can provide external domains that resolve via DNS to internal IP addresses (DNS rebinding / SSRF). It was also discovered that conditional logic (checking if an optional parameter exists before validation) is necessary to avoid functional regressions when validating optional query parameters.
**Prevention:** Implement an async `isValidExternalUrl` utility function utilizing `dns.promises.lookup` to preemptively resolve and inspect the target IP address. Reject all local, private, and loopback IP addresses before the request is issued. Always use conditional checks (e.g. `if (url && !(await isValidExternalUrl(url)))`) for optional query parameters.
