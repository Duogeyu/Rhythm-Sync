## 2024-05-24 - Path Traversal in Express File Serving

**Vulnerability:** The Express backend used unvalidated dynamic route parameters (`req.params.fileName`, `req.params.id`, `req.params.gameId`) directly in `path.join()` across multiple endpoints (e.g., `/api/covers/:gameId/:fileName`, `/api/random/image/:id`, `/api/share/:id/image`, `/api/bot/result/:id/image`, `/api/bot/result/:id`). This allowed attackers to use encoded characters like `%2f` and `..` to traverse out of intended directories and read arbitrary files on the server.

**Learning:** Express decodes URL parameters by default before routing (e.g., `%2f` becomes `/`). When these values are passed to `path.join()`, it evaluates the traversal sequences, completely bypassing any superficial route path constraints.

**Prevention:** Always validate all file-system related route parameters using a strict blocklist (like `isSafeFilename`) that prohibits `..`, `/`, `\`, and other illegal path characters *before* passing them to any `fs` or `path` operations. This is efficiently done globally using `app.param(['paramNames...'], validationMiddleware)`.
