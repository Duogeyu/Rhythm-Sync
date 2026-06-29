## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-04-20 - SSRF Prevention via Agent override
**Vulnerability:** External image download endpoints via `axios` could be forced to fetch internal IPs directly via redirects, bypassing custom DNS lookup logic. 0.0.0.0/8 was also unblocked.
**Learning:** Overriding `dns.lookup` in an `http.Agent` does NOT intercept requests directed explicitly at an IP address (e.g., following a 302 redirect to `127.0.0.1`). When `options.host` is already an IP, Node's `net.createConnection` skips `lookup` entirely.
**Prevention:** To fully mitigate SSRF in Node.js HTTP clients, you must extend `http.Agent` and `https.Agent` to override `createConnection`. In the override, explicitly check `options.host` using `net.isIP()` and validate it against an internal IP blocklist before delegating to `super.createConnection`. Also ensure you block the entire `0.0.0.0/8` subnet.
