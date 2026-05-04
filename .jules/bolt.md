## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.

## 2023-10-28 - [Optimize Jaccard Bigram Generation]
**Learning:** Generating string bigrams using `substring` inside a hot loop (like `stringSimilarity`) creates excessive temporary strings and adds significant Garbage Collection overhead.
**Action:** Use bitwise packing (`(s.charCodeAt(i) << 16) | s.charCodeAt(i + 1)`) to combine two 16-bit characters into a single 32-bit integer for Set insertion and lookup. This performs identical logic without string allocations, making it >2x faster and drastically reducing GC pressure.
