## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-04-23 - Prevent SSRF via URL Hostname and Preemptive DNS Checks
**Vulnerability:** The application was vulnerable to Server-Side Request Forgery (SSRF) when fetching external cover images. It allowed fetching URLs without any restrictions, enabling attackers to target internal IP ranges, loopback interfaces (like `127.0.0.1`), or cloud metadata servers (like `169.254.169.254`).
**Learning:** Initial attempts to block SSRF solely by parsing the URL's hostname string were insufficient because DNS resolution was ignored. Attackers could bypass string-based checks by using public domains that resolve to internal IPs (e.g., `localtest.me` resolving to `127.0.0.1`, or DNS rebinding attacks).
**Prevention:** Always use `dns.promises.lookup` to resolve the hostname to its underlying IP address *before* making the request. Validate both the original hostname string and the resolved IP against a comprehensive list of private/link-local/loopback IPv4/IPv6 ranges.
