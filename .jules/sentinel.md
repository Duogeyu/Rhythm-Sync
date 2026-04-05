
## 2024-05-18 - Prevent Path Traversal in Express APIs
**Vulnerability:** Path Traversal via dynamic route parameters (`id`, `fileName`, `gameId`, etc.) injected directly into `path.join()`.
**Learning:** Express implicitly decodes URL-encoded slashes (`%2f` to `/`), meaning malicious traversals bypass standard endpoint path matching.
**Prevention:** Apply an explicit middleware validation (`app.param(['id', ...])`) using `isSafeFilename` that explicitly rejects `/`, `\`, `..`, and `\0` before parameters reach file-system sinks.
