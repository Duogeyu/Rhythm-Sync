## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2024-05-27 - SSRF via External URL Fetching
**Vulnerability:** The application was vulnerable to SSRF in `/api/covers/:gameId/:fileName`, `downloadAndCacheCover` and `generateSongImage` endpoints. It passed user-controlled URL inputs directly to `axios.get` without validation, allowing internal network scanning.
**Learning:** `axios.get` inherently follows redirects and fetches any provided URL, including local loopback (`127.0.0.1`), private networks (`192.168.x.x`, `10.x.x.x`), and potentially local files or metadata endpoints if not explicitly blocked. The endpoints conditionally accepted `url` and `song.coverUrl` parameters directly from untrusted input.
**Prevention:** Implement strict pre-flight URL validation. Validate the URL protocol (`http/https`) and perform a preemptive DNS lookup (`dns.promises.lookup`) to check if the resolved IP address falls within prohibited ranges (loopback, private, link-local) before passing the URL to any request library.
