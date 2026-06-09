## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2024-05-18 - [SSRF in Cover Downloads]
**Vulnerability:** The application blindly downloaded images from user-supplied URLs via axios without validating if the destination pointed to the internal network. Additionally, on download failure, the user was redirected to the unvalidated URL, maintaining an Open Redirect vulnerability.
**Learning:** Preventing SSRF in Node.js requires more than just URL string checking because DNS rebinding allows an attacker to switch the IP address after the initial validation but before the request. Furthermore, axios natively follows redirects, expanding the attack surface.
**Prevention:** Always validate the URL syntax first to drop non-HTTP/HTTPS schemes. Then, implement a custom `dns.lookup` function injected into `http.Agent` and `https.Agent` for the outgoing request client (e.g., axios) to validate the resolved IP address immediately before the socket connects. Never redirect unvalidated URLs to the client upon failure.
