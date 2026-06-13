## 2025-02-14 - SSRF Vulnerability in Cover Download Feature
**Vulnerability:** The application was downloading user-provided cover image URLs directly using `axios.get` without checking if the URL points to internal services or localhost (Server-Side Request Forgery).
**Learning:** External libraries like Axios do not inherently protect against SSRF or DNS rebinding. They will happily resolve and connect to internal IPs if asked to do so by a user payload.
**Prevention:** Always implement a custom `dns.lookup` function and validate parsed hostnames against a comprehensive internal IP blocklist when using `http.Agent`/`https.Agent` to fetch user-provided URLs. Verify URLs before even initializing the request.
