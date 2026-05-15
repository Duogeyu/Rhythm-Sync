## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-04-20 - TOCTOU DNS Rebinding SSRF Protection
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint fetched external images based on user-provided URLs using `axios.get()`. Even with basic URL string validation, attackers could bypass restrictions using DNS Rebinding (Time-Of-Check to Time-Of-Use), making the server fetch internal assets (SSRF).
**Learning:** Checking the URL string is insufficient if the HTTP client (Axios) performs its own DNS resolution, as the IP could change between the check and the actual request.
**Prevention:** Implement preemptive DNS resolution (`dns.promises.lookup`), validate the resolved IP against private/local ranges, and rewrite the Axios request URL to use the validated IP directly. Set `maxRedirects: 0` to prevent redirect bypasses, and explicitly pass the original `Host` header and `servername` (SNI) to ensure HTTPS works correctly.
