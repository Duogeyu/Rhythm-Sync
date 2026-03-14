## 2024-05-24 - Missing isSafeFilename check in dynamic routes
**Vulnerability:** Path Traversal
**Learning:** `req.params` from dynamic routes used in `path.join` can result in accessing files outside intended directories if not validated with `isSafeFilename`.
**Prevention:** Always validate `req.params` with `isSafeFilename` before using in `fs` or `path` operations.
