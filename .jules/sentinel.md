## 2024-05-24 - Path Traversal in Express Route Parameters
**Vulnerability:** Path Traversal via Express dynamic route parameters (`req.params`) in file-serving endpoints (`/api/covers/:gameId/:fileName`, `/api/share/:id/image`, etc.).
**Learning:** Express decodes URL-encoded parameters (e.g., `%2f` becomes `/`), allowing directory traversal payloads to bypass route matching and be evaluated dangerously by `path.join()`.
**Prevention:** Always validate dynamic route parameters using an explicit `isSafeFilename` check (blocking `..`, `/`, `\`, `\0`) before passing them to filesystem methods.
