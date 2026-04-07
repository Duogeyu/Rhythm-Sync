## 2024-05-18 - Replace fuse.js with fuzzysort for faster fuzzy matching
**Learning:** `fuzzysort` is significantly faster than `fuse.js` for matching strings, especially with large sets of songs. The backend is currently using `fuse.js` in a few endpoints and workers. Native negative scoring from `fuzzysort` must be normalized.
**Action:** Replace `fuse.js` with `fuzzysort` in `server/match_worker.js`.
