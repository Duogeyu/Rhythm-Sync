## 2026-04-03 - Path Traversal in File Endpoints
**Vulnerability:** Endpoints serving local files (e.g. `/api/covers/:gameId/:fileName`) accepted unvalidated dynamic parameters.
**Learning:** Route parameters are decoded by Express (e.g. `%2f` -> `/`), so evaluating them with `path.join` allows path traversal even if the frontend didn't intend it.
**Prevention:** Apply a global `isSafeFilename` validation middleware using `app.param()` across vulnerable keys (`id`, `fileName`, `gameId`, `shareId`) to reject directory traversal sequences before hitting filesystem methods.
