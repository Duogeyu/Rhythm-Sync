## 2025-03-16 - Path Traversal in Express File Serving Endpoints
**Vulnerability:** Path traversal vulnerability due to using unsanitized `req.params` (like `:id` or `:fileName`) directly in `path.join` for `fs` operations in Express endpoints.
**Learning:** Express automatically URL-decodes path variables, meaning `%2e%2e%2f` decodes to `../` and can bypass basic route matching, allowing attackers to access files outside the intended directories via `path.join`.
**Prevention:** Always validate and sanitize dynamic route parameters using an `isSafeFilename` function that explicitly blocks directory traversal characters ('..', '/', '\') and null bytes ('\0') before passing them to filesystem operations. Return 400 Bad Request immediately if validation fails.
