1. **Identify the vulnerability**: The application is vulnerable to Server-Side Request Forgery (SSRF) in `/api/covers/:gameId/:fileName` endpoint where user-supplied URL `req.query.url` is directly fetched using `axios.get(originalUrl, ...)` without any validation. Other occurrences like `coverResp = await axios.get(song.coverUrl, ...)` are similarly vulnerable if `song.coverUrl` can be controlled.
2. **Add `isValidExternalUrl` utility**: We'll define a function `isValidExternalUrl` in `server/index.js` (or `utils.js`) to parse the URL, check its protocol, resolve its hostname, and block internal IPs.
3. **Patch `/api/covers/:gameId/:fileName`**:
    - Retrieve `originalUrl`.
    - Validate with `isValidExternalUrl(originalUrl)`.
    - Rewrite the `axios` request to use the resolved IP to prevent DNS rebinding.
4. **Pre-commit step**: Test the node app (`node -c server/index.js`) and review changes before commit.
