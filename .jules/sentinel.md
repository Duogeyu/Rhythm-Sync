## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-05-18 - SSRF DNS Rebinding & Open Redirect Protection
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint fetched arbitrary user-controlled URLs (`originalUrl`) without validation.
**Learning:** Node.js's `net.Socket` skips custom `dns.lookup` functions if the target hostname is already a direct IP. Additionally, external targets can redirect to internal IPs.
**Prevention:**
1. Always implement an `isSafeUrl` function to parse targets and reject internal IP hostnames *before* making the request.
2. Intercept DNS resolution at the `http.Agent`/`https.Agent` level using a custom `lookup` function to prevent DNS rebinding attacks.
3. Explicitly hook `beforeRedirect` in Axios to re-validate redirect target URLs.
