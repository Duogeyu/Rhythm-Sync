## 2025-05-05 - SSRF via Unrestricted External URL Fetching
**Vulnerability:** The server was fetching image URLs provided by users or APIs (`axios.get(originalUrl)`) without any validation of the destination. This allowed an attacker to supply a URL pointing to internal services (e.g., `http://127.0.0.1:6379`, cloud metadata APIs, or other internal loopback addresses) causing Server-Side Request Forgery (SSRF).
**Learning:** `axios` will faithfully follow redirects and resolve any hostname, making it easy to exploit SSRF. A common bypass for basic SSRF filters is Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding, where the attacker's DNS server returns a benign IP during validation but malicious internal IP when `axios` fetches it.
**Prevention:**
1. Explicitly check if the destination is internal/private *after* DNS resolution.
2. Fix TOCTOU by making the actual `axios.get` call directly to the resolved IP address (rather than the domain), and manually set the `Host` header to preserve the original intended target.
3. Block 302 redirects (`maxRedirects: 0`) to prevent bypasses where the server redirects to a local IP.
