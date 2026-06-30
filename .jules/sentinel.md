## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-06-30 - Prevent SSRF via axios redirect
**Vulnerability:** Cover API fetched user-controlled URLs using `axios.get()` without validating internal IPs, leading to SSRF.
**Learning:** `axios` follows HTTP redirects by default. Adding `isSafeUrl` on the initial URL is not enough if a remote attacker server returns an HTTP 302 redirect pointing to an internal IP (like `http://127.0.0.1`). Axios will fetch the redirect directly via IP, bypassing custom `dns.lookup` completely because Node's `net.Socket` skips DNS resolution for IP addresses.
**Prevention:** In addition to validating the initial URL and overriding `dns.lookup` for standard hostnames, we must explicitly intercept redirects using Axios's `beforeRedirect` hook to re-validate the target URL with `isSafeUrl()`.
