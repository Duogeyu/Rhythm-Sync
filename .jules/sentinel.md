## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.
## 2026-04-20 - SSRF via Cover Proxy & IPv4-mapped IPv6 Bypass
**Vulnerability:** The `/api/covers/:gameId/:fileName` proxy accepted arbitrary `?url=` parameters and fetched them without validation, leading to SSRF and Open Redirect upon download failure.
**Learning:** Checking for IPv6 loopback addresses like `::1` is insufficient if the IP resolution yields an IPv4-mapped IPv6 address (e.g., `::ffff:127.0.0.1`). Attackers can bypass naive IPv6 lists to target internal IPv4 networks. Furthermore, DNS rebinding (TOCTOU) requires the network request to explicitly use the validated IP address while manually maintaining HTTP `Host` and SNI parameters.
**Prevention:**
1. Always resolve domains to IPs (`dns.promises.lookup`) and validate the IP against RFC 1918 / localhost ranges.
2. For IPv6, strictly normalize IPv4-mapped formats (`::ffff:`) back into standard IPv4 strings before running IPv4 blocklist checks.
3. Use the resolved IP in the network fetch to prevent TOCTOU DNS Rebinding, manually configuring `Host` and `httpsAgent` to retain TLS integrity.
4. Disable auto-redirects (`maxRedirects: 0`) and never redirect the user to the raw external URL (`res.redirect`) upon failure to avoid Open Redirects.
