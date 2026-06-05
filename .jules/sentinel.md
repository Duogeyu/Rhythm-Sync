## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-06-05 - SSRF Bypass via Open Redirect in Error Handlers
**Vulnerability:** The `/api/covers` proxy endpoint fetched user-provided URLs using `axios.get` without SSRF protection. Critically, its error handler (catch block) executed `res.redirect(originalUrl)` when the fetch failed (e.g., due to an invalid protocol like `javascript:` or an internal service returning an error).
**Learning:** Fallback mechanisms that redirect to user-provided input upon failure preserve Open Redirect vulnerabilities and create an SSRF bypass. Even if initial checks were present, forcing an error would allow the attacker to hit the redirect fallback.
**Prevention:** Never use `res.redirect()` with unvalidated, user-provided URLs, especially within error handlers. Ensure catch blocks fail securely by returning generic error messages (e.g., 500 or 400 status codes) rather than passing the malicious input back in the response.
