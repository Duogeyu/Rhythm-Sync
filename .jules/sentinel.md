## 2024-05-24 - Path Traversal Vulnerability in Express Endpoints
**Vulnerability:** Multiple Express endpoints directly accepted user-provided parameters (`gameId`, `fileName`, `shareId`, `id`) and joined them into file paths using `path.join()`, allowing path traversal attacks via `..`, `/` or `\` characters.
**Learning:** Even when serving generated IDs or game IDs, user input via URL parameters cannot be trusted and must be explicitly validated before being used in file system operations.
**Prevention:** Implement and enforce a strict `isSafeFilename` utility to block traversal characters, and validate IDs using strict alphanumeric regex patterns (`/^[a-zA-Z0-9]+$/`) at the top of route handlers before any path resolution.
