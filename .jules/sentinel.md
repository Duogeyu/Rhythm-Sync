## 2024-03-08 - Path Traversal in Express dynamic routes

**Vulnerability:** Path Traversal
**Learning:** The Express application used dynamic URL parameters (`req.params.id` and `req.params.shareId`) directly in `path.join()` alongside `__dirname` to construct file paths for `fs` operations (e.g., `fs.existsSync`, `fs.readFileSync`). This allowed an attacker to input path traversal characters (like `../../../../etc/passwd`) via the URL, potentially allowing them to read arbitrary files on the server's file system.
**Prevention:** Always sanitize and validate user input, especially route parameters that are used to construct file paths. A whitelist approach using a strict regular expression (e.g., `/^[a-zA-Z0-9_.-]+$/`) is highly effective at ensuring the filename is safe. Additionally, explicitly checking for and rejecting directory traversal sequences (`..`, `/`, `\`) provides a defense-in-depth mechanism.
