## 2024-05-15 - [Identify readCache fs sync operations]
**Learning:** `fs.readFileSync` combined with `JSON.parse` blocking event loops when hit on every query can be an immense performance bottleneck especially with large datasets such as games' song caches.
**Action:** When working on heavily caching-reliant API applications in node.js, leverage an in-memory L1 cache (such as a `Map`) alongside an L2 file system cache. This avoids repetitive expensive string parsing and disk I/O, thus improving API response times drastically.
