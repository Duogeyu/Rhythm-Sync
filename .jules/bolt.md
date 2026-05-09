## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.

## 2024-05-10 - [Optimize regex execution in high-frequency title normalization]
**Learning:** In hot loops such as string normalization during matching tasks across thousands of objects, using in-line regular expressions (e.g. `.replace(/\s+/g, '')`) incurs compilation overhead on each invocation.
**Action:** Extract regular expressions that are reused within functions into constants defined at the module scope (e.g. `REGEX_COMMON_SPACE`) and apply them directly. This avoids recompilation and reduces total execution time.
