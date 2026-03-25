
## 2024-05-24 - [Replace Fuse.js with fuzzysort]
**Learning:** `Fuse.js` becomes a major performance bottleneck for large datasets like game song lists during fuzzy matching loops (especially inside `/api/match-all` and `server/match_worker.js`). `fuzzysort` runs orders of magnitude faster because of its string matching algorithm and allows score normalization.
**Action:** When working with thousands of objects per game, replace `Fuse.js` with `fuzzysort` in nested loops and pre-prepare fields before searching. Make sure to map `fuzzysort`'s negative scores back to a `0..1` normalized score where needed for compatibility.
