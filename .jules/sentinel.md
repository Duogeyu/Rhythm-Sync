## 2026-06-07 - Add SSRF Protection via custom DNS Lookup
**Vulnerability:** The application was downloading external image URLs based on user input without adequate validation, potentially allowing SSRF. The application would fetch URLs locally if an attacker specified a localhost IP.
**Learning:** SSRF bugs in Node are best fixed utilizing custom DNS resolvers that discard resolving to internal IPs, avoiding Time of Check Time of Use (TOCTOU) DNS rebinding attacks. Also, disabling automated redirects natively on requests allows tracking any multi-hop attacks.
**Prevention:** Utilizing a unified validation method with custom HTTP/HTTPS agents handles IP blocking robustly.
