
## 2026-04-06 - Path Traversal via Dynamic Route Parameters
**Vulnerability:** Found multiple file-serving Express routes (e.g., `/api/covers/:gameId/:fileName`) taking parameters straight from `req.params` and using them inside `path.join()`. This is highly susceptible to path traversal payloads like `..` resulting in local file read.
**Learning:** Due to how Express resolves dynamic routes, payloads such as `%2f` and `%2e` might be decoded or passed through without standard path validation, causing `path.join()` to evaluate arbitrary filesystem locations. Relying purely on frontend constraints or implicit assumptions allows trivial bypass via direct API manipulation.
**Prevention:** Establish a global middleware validation mechanism using `app.param(['id', 'fileName', 'gameId', ...])` combined with an `isSafeFilename` utility to centrally deny suspicious sequences (`..`, `/`, `\`, `\0`) before they reach route handlers.
