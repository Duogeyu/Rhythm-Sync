## 2025-06-15 - SSRF Protection on Cover Downloads
**Vulnerability:** The application was downloading external URLs via \`downloadAndCacheCover\` in \`server/index.js\` based on user inputs without SSRF protections or URL validations, and redirecting clients to malicious originalUrls on error.
**Learning:** Even internal cache-fetch operations (like cover downloading) can be leveraged for SSRF if the inputs are directly derived from user queries and passed to generic \`axios.get()\` or \`res.redirect()\`.
**Prevention:** Add a centralized URL and IP validation checking against private networks (\`isSafeUrl\` / \`isInternalIp\`) and use a custom \`dns.lookup\` wrapper for axios Agents. Instead of redirecting on failure, respond with 500 status.
