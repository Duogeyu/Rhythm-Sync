## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-06-10 - SSRF Prevention via Agent
**Vulnerability:** SSRF vulnerability when fetching URLs
**Learning:** Redirects can bypass custom dns lookups, because Axios follows redirects natively and if it redirects to an IP, dns lookup is not called.
**Prevention:** Ensure that you don't broadly set `maxRedirects: 0` but instead rely on passing the custom DNS validating agent. Note: I did that for this task.
