## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2024-05-29 - Prevent SSRF in cover download APIs
**Vulnerability:** The `/api/covers/:gameId/:fileName` endpoint and background cover downloader `downloadAndCacheCover` allowed SSRF by blindly fetching a user-controlled `url` query parameter.
**Learning:** External URLs provided via client input should never be fetched directly without verifying their protocol and destination host.
**Prevention:** Introduce `isSafeUrl(url)` utility to ensure URLs use `http`/`https` and do not target internal networks (e.g. `localhost`, `10.x.x.x`, `169.254.x.x`). Additionally, handle download errors securely without redirecting back to the potentially malicious URL.
