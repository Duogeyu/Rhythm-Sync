## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-04-20 - Global SSRF Protection via safeLookup and isSafeUrl
**Vulnerability:** The proxy endpoint `/api/covers/:gameId/:fileName` and `downloadAndCacheCover` blindly passed user-provided URLs to `axios.get()` without validation, allowing Server-Side Request Forgery (SSRF) and DNS rebinding to access local IPs or cloud metadata (e.g., 169.254.169.254).
**Learning:** Preventing SSRF requires both upfront validation (parsing the URL to reject obvious internal IPs, paying special attention to IPv4-mapped IPv6 like `::ffff:127.0.0.1` and bracketed IPs) and DNS-level mitigation (a custom `http.Agent` with `lookup` to reject internal IPs resolved at request time).
**Prevention:** Always use a global `isSafeUrl` function to parse and validate incoming URLs. Furthermore, initialize singletons for `safeHttpAgent` and `safeHttpsAgent` equipped with a custom DNS `lookup` function that calls `isInternalIp` on the resolved address, and attach them (along with `maxRedirects: 0`) to all server-side Axios requests.
