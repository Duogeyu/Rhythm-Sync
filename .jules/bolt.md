## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.
## 2026-05-03 - [Bitwise Packing for Bigrams]
**Learning:** In memory-intensive JavaScript string operations like Bigram generation for Jaccard similarity, `.substring()` string segmentations create excessive temporary string objects, leading to high garbage collection overhead in hot loops.
**Action:** Replace `.substring()` with bitwise packing of character codes (e.g., `(a.charCodeAt(i) << 16) | a.charCodeAt(i + 1)`) to eliminate temporary string creation and drastically reduce GC pressure.
