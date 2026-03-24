## 2024-03-24 - [Fix Path Traversal in File APIs]
**Vulnerability:** User inputs passing directly into path string concatenation across several file APIs (like `/api/covers/:gameId/:fileName`). An attacker could provide path traversal sequences (like `../`) and fetch any file.
**Learning:** Due to Express parameter parsing, relying simply on routing doesn't strip traversal characters from parameters if they are url-encoded. Explicitly validating all input parts before `path.join` is needed.
**Prevention:** Implement and reuse an `isSafeFilename` check before any file interaction that relies on unsanitized parameters to catch invalid path parts (`..`, `/`, `\`, `\0`).
