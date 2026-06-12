## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.
## 2024-06-12 - [Pre-compile Regular Expressions]
**Learning:** In string intensive tasks, specifically the `normalizeTitle` and `normalizeArtist` functions which are called thousands of times during matching, inline regular expressions created an overhead.
**Action:** Extract inline regular expressions into global variables within `server/utils.js` so they are compiled only once, reducing CPU usage and memory churn per invocation.
