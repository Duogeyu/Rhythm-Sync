## 2024-05-24 - [Replaced Fuse.js with fuzzysort]
**Learning:** Replacing Fuse.js with fuzzysort for multi-field search requires explicitly preparing fields (e.g., preparedTitle, preparedArtist) and mapping them in the keys array of fuzzysort.go() to prevent regressions where secondary fields are ignored.
**Action:** Always prepare fields explicitly when using fuzzysort.
