
## 2024-05-20 - O(N*M) String Algorithms in Event Loop
**Learning:** Nested loops containing array allocations (e.g., $O(N \times M)$ memory `matrix` arrays) within string comparison algorithms (like Levenshtein Distance) execute synchronously, putting extreme pressure on Garbage Collection and blocking the single-threaded Node.js event loop during fuzzy search matches against large data sets.
**Action:** When calculating Levenshtein Distance, optimize the algorithm to space complexity $O(\min(N, M))$ using a globally declared 1D `Uint16Array` (with fallback for unexpectedly long strings). This eliminates per-request allocations and drastically improves performance.
