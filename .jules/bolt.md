## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.

## 2026-05-10 - [Optimize Jaccard Similarity Bigram Generation]
**Learning:** Generating string bigrams using `substring(i, i + 2)` creates many short-lived string objects, causing high garbage collection overhead in hot loops.
**Action:** Replaced `.substring()` with bitwise character code packing: `(s.charCodeAt(i) << 16) | s.charCodeAt(i + 1)`. This avoids string allocation entirely, which benchmarked to a >2x speedup in this codebase.
