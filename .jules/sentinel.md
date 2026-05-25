## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2024-05-18 - [CRITICAL] Prevent SSRF and Open Redirect in axios download endpoints
**Vulnerability:** The application was vulnerable to Server-Side Request Forgery (SSRF) and Open Redirect in `/api/covers/:gameId/:fileName`, `downloadAndCacheCover`, and `generateSongImage` because it accepted user-controlled URLs in `req.query.url` and `song.coverUrl` and passed them directly to `axios.get` without any validation against internal networks. Additionally, the catch block in the proxy endpoint redirected the user to the raw, unvalidated URL if the download failed. This could be exploited via DNS rebinding attacks.
**Learning:** Checking the URL string for internal IPs is insufficient due to Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks. `axios` will follow HTTP 302 redirects by default unless `maxRedirects: 0` is set, leading to SSRF bypasses if the redirect points to an internal resource.
**Prevention:**
1. Validate that the user-provided URL protocol is strictly `http://` or `https://`.
2. Disable automatic redirects (`maxRedirects: 0`) in `axios` configuration.
3. Hook into the `httpAgent` and `httpsAgent` of `axios` using a custom `dns.promises.lookup` function. Inside this hook, validate the resolved IP address to reject requests attempting to access `0.0.0.0`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, and specific IPv6 loopbacks/ULA. Handle `::ffff:` IPv4-mapped prefixes by stripping them before the check.
4. Replace `res.redirect(originalUrl)` in error handlers with a secure HTTP 502 JSON response to prevent Open Redirects.
