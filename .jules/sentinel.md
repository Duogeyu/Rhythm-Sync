## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-06-14 - SSRF and Open Redirect in Proxy/Download Endpoints
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint fetched arbitrary URLs provided in the `url` query parameter without resolving and validating the final IP, leading to SSRF. Furthermore, on failure, it redirected the client to the `originalUrl`, causing an Open Redirect.
**Learning:** Proxy and download endpoints must validate the destination IP address of user-controlled URLs before making requests to prevent internal network scanning (SSRF). Additionally, failure blocks (e.g., `catch`) should not redirect the user back to the unvalidated URL, as this exposes an Open Redirect and potential SSRF bypass vector.
**Prevention:** Implement a custom `dns.lookup` function for `http`/`https` agents in Axios to validate IPs against blocklists before the connection is established. Replace unsafe error redirects with standard error responses (e.g., 502 Bad Gateway).
