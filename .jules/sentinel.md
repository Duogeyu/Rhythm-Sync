
## 2024-05-18 - Path Traversal Vulnerability in Express Endpoints Serving Files
**Vulnerability:** API endpoints serving local files via Express route parameters (`req.params.id`) were not properly validating inputs before using `path.join()`, allowing Path Traversal attacks (e.g., passing `%2e%2e%2f` to reach files outside the intended directory).
**Learning:** Express decodes URL parameters by default (e.g., `%2f` becomes `/`), and if passed directly to `fs` or `path` functions, it evaluates them natively, enabling traversal. Standard alphanumeric validation may break valid IDs that include `-`, `_`, `.`, or `[`.
**Prevention:** Implement a non-regex explicit utility (e.g., `isSafeFilename`) that specifically blocks directory traversal characters (`..`, `/`, `\`, `\0`) to sanitize inputs while still permitting diverse valid ID formats, and validate all path components at the endpoint boundary.
