## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.
## 2024-06-03 - [In-memory Cache for File Reads]
**Learning:** Node.js file operations, even when cached on the OS level, can block the event loop noticeably when called repeatedly with `fs.readFileSync` (e.g., parsing 50k objects from JSON takes >50ms per call).
**Action:** Always wrap high-frequency file reads with an in-memory layer (like a `Map`) when the cache state is easily trackable, ensuring `clear-cache` mechanisms also invalidate the `Map`.
