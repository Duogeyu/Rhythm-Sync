## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-05-06 - SSRF and DNS Rebinding Protection via proxy
**Vulnerability:** The proxy endpoint `/api/covers/:gameId/:fileName` fetches user-provided URLs using `req.query.url` blindly. It is vulnerable to Server-Side Request Forgery (SSRF) and Time-Of-Check Time-Of-Use (TOCTOU) DNS Rebinding attacks because it sends external requests without URL validation.
**Learning:** URL parameters must always be validated. The IP resolution process (`dns.promises.lookup`) combined with directly using the resolved IP as the URL destination prevents SSRF. Additionally, preserving the original hostname in `Host` header and `httpsAgent`'s `servername` allows SNI to work, while disabling redirects (`maxRedirects: 0`) ensures full mitigation.
**Prevention:** Implement an `isValidExternalUrl` utility function and validate all external URL fetches. Use the resolved IP and disable redirects.
