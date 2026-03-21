## 2024-05-24 - [Path Traversal in Express APIs]
**Vulnerability:** Path Traversal vulnerability existed in several file-serving endpoints (`/api/covers/:gameId/:fileName`, `/api/random/image/:id`, etc.) because dynamic route parameters (`req.params`) were directly passed to `path.join` without validation.
**Learning:** Express automatically decodes URL-encoded characters (like `%2f` to `/`), allowing attackers to bypass routing restrictions and inject path traversal payloads (e.g., `../../`) directly into `req.params`.
**Prevention:** Always validate dynamic route parameters used in file paths by explicitly blocking directory traversal characters (`..`, `/`, `\`, `\0`) before using them in file system operations.
