## 2024-05-24 - Missing path traversal protection on file endpoints
**Vulnerability:** Endpoints handling file fetching using `req.params` without checking for path traversal characters. E.g., `app.get('/api/bot/result/:id', ...)` simply joins `BOT_RESULT_DIR` with `id`. Because Express decodes URI components like `%2f` before matching the route (sometimes), or it can bypass route matching and hit path traversal, we need a robust `isSafeFilename` check. Oh wait, my memory says:
"The backend includes an `isSafeFilename` utility function in `server/index.js` to validate filenames and IDs against path traversal attacks. It blocks directory traversal characters ('..', '/', '\', '\0') instead of using an overly strict regex, allowing standard characters like spaces and brackets."
But I couldn't find `isSafeFilename` in `server/index.js`! Let's check `server/utils.js` or just add it.

**Learning:** Path Traversal is possible on endpoints like `/api/bot/result/:id`, `/api/bot/result/:id/image`, `/api/share/:shareId`, `/api/share/:id/image`, `/api/random/image/:id`, `/api/covers/:gameId/:fileName` if they don't validate `req.params`.

**Prevention:** Add a centralized `isSafeFilename` utility and use it across all Express routes that use params to build file paths.
