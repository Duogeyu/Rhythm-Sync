## 2026-04-18 - Path Traversal Vulnerability in Backend Covers Endpoint
**Vulnerability:** Path traversal possible via unvalidated `fileName` parameters in Express endpoints (e.g., `/api/covers/:gameId/:fileName`), allowing an attacker to read arbitrary files via `../`.
**Learning:** `req.params` variables directly used in `path.join` operations without sanitization inherently introduce severe path traversal risks in Express.js.
**Prevention:** Always validate path parameters using global parameter checks (`app.param`) and ensure custom validators block `..`, `/`, `\`, and `\0` before they reach file system functions like `path.join`.
