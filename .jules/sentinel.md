
## 2024-05-24 - [CRITICAL] Path Traversal in Express routes via path.join
**Vulnerability:** Several Express routes (`/api/covers/:gameId/:fileName`, `/api/random/image/:id`, etc.) took user input directly from `req.params` and concatenated them with a directory path using `path.join()` without prior sanitization or validation.
**Learning:** This exposed the application to Path Traversal vulnerabilities where an attacker could access or modify arbitrary files by supplying directory traversal characters like `..` (encoded as `%2f..%2f`) in the dynamic route parameters.
**Prevention:** All user inputs derived from dynamic route parameters must be validated to ensure they do not contain path traversal characters (like `..`, `/`, `\`, `\0`) before using them in file system operations. An `isSafeFilename` utility method that specifically checks for these invalid characters should be used.
