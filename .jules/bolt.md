## 2026-03-06 - [Replace fuse.js with fuzzysort]
**Learning:** The codebase previously used `fuse.js` which has been noted in the memory to have been replaced by `fuzzysort` for performance gains. However, some areas still use `fuse.js` directly (like in `/api/match-all` and `match_worker.js`).
**Action:** Replaced `fuse.js` with `fuzzysort` everywhere for consistency and massive performance gains on large lists.
