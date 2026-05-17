## 2025-05-17 - Prevent SSRF and TOCTOU DNS Rebinding in Axios

**Vulnerability:** The application was vulnerable to Server-Side Request Forgery (SSRF) in the cover download proxy functionality due to directly fetching user-provided URLs using `axios.get(url)`. This allowed attackers to scan internal networks, access loopback services, or read cloud metadata (169.254.169.254).

**Learning:** Simple string matching on URLs is insufficient to prevent SSRF because hostnames can resolve to internal IPs, or an attacker can use DNS rebinding (changing the IP resolution between the time the app checks it and when `axios` fetches it). Additionally, 302 redirects can bypass initial checks if `axios` follows them automatically.

**Prevention:**
1. **Pre-Resolve DNS:** Always use `dns.promises.lookup` to resolve the hostname to an IP address *before* making the HTTP request.
2. **Check the IP:** Validate the resolved IP against a blocklist of private, loopback, and reserved ranges (including IPv6 ULA/Link Local and IPv4-mapped IPv6).
3. **Rewrite Request (Prevent DNS Rebinding):** Rewrite the target URL to use the *resolved IP address* instead of the hostname.
4. **Preserve Headers:** Explicitly set the `Host` HTTP header and configure the `https.Agent` with `servername: originalHostname` so SNI and virtual hosting work correctly.
5. **Disable Redirects:** Set `maxRedirects: 0` in `axios` to prevent a malicious external server from redirecting the request back to an internal IP.
