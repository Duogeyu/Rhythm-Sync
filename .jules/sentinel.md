## 2026-04-02 - Path Traversal Prevention
**Vulnerability:** The Express backend passed URL parameters directly into `path.join` and `fs` functions for file serving.
**Learning:** Because Express decodes URL-encoded parameters (e.g., `%2f` to `/`), path traversal attempts could bypass the route matching definition and evaluate when combined with local file paths.
**Prevention:** Always validate parameters with `isSafeFilename` explicitly before using them in filesystem operations. Using `app.param` to validate these globally across the application provides a central defense-in-depth point.
