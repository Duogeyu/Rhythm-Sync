## 2026-02-26 - [CRITICAL] Fixed Path Traversal in File APIs
**Vulnerability:** Path Traversal in `/api/share/:shareId` and related endpoints.
**Description:** The application used user-supplied input (like `shareId` or `id`) directly in `path.join()` without validation. By submitting `../` sequences (e.g., `../../package`), an attacker could read arbitrary files (like `package.json` or config files) and potentially delete them if the expiration logic triggered `fs.unlinkSync`.
**Learning:** Even when using `path.join()`, path traversal is possible if the user input contains `..` segments. Express parameters (`req.params`) are URL-decoded, so `%2e%2e` becomes `..`.
**Prevention:**
1. Always validate filenames/IDs against a strict allowlist (e.g., `^[a-zA-Z0-9]+$`) when possible.
2. If flexible naming is required, explicitly reject strings containing `..`, `/`, or `\` using a helper like `isSafeFilename`.
3. Never trust `req.params` blindly in filesystem operations.
