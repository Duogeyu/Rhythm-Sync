## 2024-05-15 - Express URL Decoding Bypass via Path Parameters
**Vulnerability:** Path Traversal (LFI) in file-serving endpoints like `/api/covers/:gameId/:fileName`
**Learning:** Express `req.params` automatically URL-decodes incoming paths. Thus, a payload like `..%2f` is decoded to `../` and directly passed to `path.join()`, allowing an attacker to escape the designated folder.
**Prevention:** Always validate URL dynamic parameters used in file system operations using a robust function like `isSafeFilename()` that explicitly rejects `..`, `/`, `\`, and `\0` before they reach `path.join()`.
