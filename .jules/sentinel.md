## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-06-08 - SSRF Bracket and Redirect Bypasses
**Vulnerability:** A custom DNS lookup SSRF filter bypassed external redirect validation (due to Axios following redirects to local IPs) and IPv6 hostname bracket syntax (`[::1]`).
**Learning:** `maxRedirects: 0` is required to prevent redirects from bypassing URL validation in Axios when `safeLookup` agent only secures DNS. IPv6 URLs parsed by `new URL` keep their brackets in the `hostname` property, bypassing `net.isIP()` and simple string-matching internal IP filters.
**Prevention:** Always strip `[` and `]` brackets before validating IPv6 hostnames, and explicitly pass custom DNS agents (`httpAgent`/`httpsAgent`) *and* disable automatic redirects (`maxRedirects: 0`) when making server-side requests to user-controlled URLs.
