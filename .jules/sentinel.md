## 2025-05-22 - [Add SSRF Prevention]
**Vulnerability:** Server-Side Request Forgery (SSRF) vulnerabilities found in multiple endpoints where the server fetches URLs provided directly or indirectly by the user or processes redirects from external APIs.
**Learning:** The application uses `axios.get` and `axios.head` with arbitrary or user-provided URLs without validating whether the resolved IP addresses point to internal network resources (like `127.0.0.1` or `169.254.169.254`).
**Prevention:** Implement a custom `lookup` function in Axios via `http.Agent` and `https.Agent` to validate IPs during DNS resolution. Apply this safe configuration to all requests fetching external data.
