## 2025-04-11 - Optimize matching with fuzzysort
**Learning:** `fuzzysort` is native and faster than `fuse.js` for string searches, especially when reusing prepared dataset keys and using specific thresholds mapped from `fuse.js`.
**Action:** Always prefer `fuzzysort` in this repository for text searches where `fuzzysort` is already present in `package.json`, and ensure memory variables maps are preserved.
