## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.

## $(date +%Y-%m-%d) - Pre-compile and Deduplicate Normalization Regex
**Learning:** The application extensively utilizes `.replace()` chains inside hot code paths (looping over arrays of songs) with inline, dynamically evaluated Regular Expressions. This leads to continuous, redundant memory allocation and garbage collection overhead.
**Action:** Extract repetitive normalization functions, pre-compile their Regex patterns as module-level global constants (using `/g`), and safely share them via `String.prototype.replace()`.
