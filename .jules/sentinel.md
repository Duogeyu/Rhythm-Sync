## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## $(date +%Y-%m-%d) - [DNS Rebinding vs TLS Validation]
**Vulnerability:** Server-Side Request Forgery (SSRF) and TOCTOU DNS Rebinding.
**Learning:** When mitigating SSRF by resolving the IP address and rewriting the URL to use that IP, the underlying `tls` module will attempt to validate the SSL certificate against the IP address. This causes `ERR_TLS_CERT_ALTNAME_INVALID` for almost all external HTTPS URLs. Additionally, blocking redirects with `maxRedirects: 0` can break functionality.
**Prevention:** Always provide a custom `checkServerIdentity` to `https.Agent` to validate the certificate against the original hostname (e.g., `checkServerIdentity: (host, cert) => tls.checkServerIdentity(parsedUrl.hostname, cert)`), rather than just setting `servername` for SNI. For redirects, either handle them manually by intercepting or accept them if the custom agent still applies correctly. Alternatively, provide a custom `lookup` method to `httpAgent`/`httpsAgent` instead of rewriting the URL string.
