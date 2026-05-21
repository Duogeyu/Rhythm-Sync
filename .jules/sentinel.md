## 2026-04-20 - Global Path Traversal Protection
**Vulnerability:** Multiple API endpoints (`/api/covers/:gameId/:fileName`, `/api/bot/result/:id`, `/api/random/image/:id`, etc.) use user input directly in `path.join` without path traversal validation.
**Learning:** `req.params` parameters must be validated to prevent directory traversal (`..`, `/`, `\`) before being used in file system operations.
**Prevention:** Implement a global `isSafeFilename` middleware using `app.param()` to automatically reject any unsafe paths across all endpoints.

## 2026-05-21 - SSRF and DNS Rebinding Prevention via Axios Lookup Override
**Vulnerability:** The API endpoint `/api/covers/:gameId/:fileName` fetched user-supplied URLs using `axios.get(req.query.url)` without validating whether the URL targeted local/internal network services, exposing an SSRF vulnerability.
**Learning:** Checking the URL string against a regex is insufficient as attackers can use DNS rebinding (TOCTOU) to bypass validation and hit internal endpoints (e.g. `localhost`). Even if a URL resolves to an external IP at check time, it could resolve to `127.0.0.1` at request time.
**Prevention:** Override Axios' HTTP and HTTPS agents with a custom `dns.promises.lookup` function. Perform DNS lookup manually first, check the resolved IP using `isInternalIp()`, and force Axios to connect specifically to the resolved IP to prevent DNS rebinding. Do not rewrite the URL to the raw IP, as that breaks HTTPS certificate validation for SNI. In failure paths (e.g., `catch`), do not fallback to an `Open Redirect` via `res.redirect(originalUrl)`.

## 2026-05-21 - SSRF and DNS Rebinding Fix Follow-up
**Learning:** `::ffff:` mapped IPv4 address stripping must occur *before* IPv4 range checks to avoid an attacker using a prefix to bypass validation entirely.
**Prevention:** In `isInternalIp`, ensure string manipulations/normalizations occur at the beginning of the function before any boundary checks.
**Learning:** Overriding Axios' lookup directly to return pre-resolved IPs breaks redirects to other domains because it stops new domain resolutions.
**Prevention:** Perform `dns.lookup` and validation *inside* the `lookup` callback hook instead, allowing Axios to invoke the logic per domain it encounters dynamically.
