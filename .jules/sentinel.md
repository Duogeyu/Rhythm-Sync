## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-07-05 - SSRF via Cover Proxy & Background Downloading Task
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint and the `downloadAndCacheCover` background task accepted unvalidated, user-controlled URLs for downloading images. More critically, Axios followed HTTP redirects by default, enabling a malicious server to respond with a 302 redirect pointing to `localhost` or an internal IP address (SSRF bypass via Open Redirect). Furthermore, error handling originally redirected clients directly to the unvalidated original URL if the download failed.
**Learning:** Preventing SSRF in Node.js requires defense-in-depth:
1. Validating the initial URL payload.
2. Using custom `dns.lookup` functions attached to `http.Agent`/`https.Agent` to perform TOCTOU-safe filtering during the actual TCP connection phase to catch DNS rebinding.
3. Catching redirects specifically in high-level HTTP clients like Axios using hooks (e.g. `beforeRedirect`) because they transparently resolve the redirect Location header without passing it back through custom URL validation.
**Prevention:** Always validate external URL parameters against an IP blocklist (blocking loopback, private ranges, cloud metadata IPs, and IPv4-mapped IPv6 IPs). Always inject custom `httpAgent`/`httpsAgent` singletons into outgoing request configurations and explicitly validate redirect destinations if the library follows them automatically.
