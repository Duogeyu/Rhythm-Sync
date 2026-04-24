## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-04-24 - SSRF Protection
**Vulnerability:** Several backend functions and API endpoints (`downloadAndCacheCover`, `/api/covers/:gameId/:fileName`, `generateSongImage`) fetched data directly using user-supplied URLs (like `originalUrl` and `song.coverUrl`) via `axios.get()` without first ensuring the URLs didn't point to internal or unintended resources. This introduces a Server-Side Request Forgery (SSRF) vulnerability.
**Learning:** We must not trust external URLs provided by users and avoid performing backend HTTP requests to those URLs blindly.
**Prevention:** Implement a `isValidExternalUrl` utility that ensures the protocol is `http`/`https` and verifies via `dns.promises.lookup` that the target hostname doesn't resolve to a loopback, private, or link-local address. Use it consistently wherever an external URL is fetched by the backend.
