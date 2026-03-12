## 2024-05-24 - [Fix Path Traversal]
**Vulnerability:** Path traversal vulnerability in Express API endpoints serving files.
**Learning:** `req.params` variables (like `id`, `gameId`, `fileName`) were passed directly into `path.join` and `fs` operations without validation against directory traversal sequences (e.g., `..`, `/`, `\`, `\0`).
**Prevention:** Always validate user-supplied filenames before constructing file paths. Added `isSafeFilename` helper to reject invalid filename characters.
