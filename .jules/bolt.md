## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.
## 2026-05-08 - Hoist Levenshtein Dependencies Correctly
**Learning:** The `levenshteinDistance` function relies on global variables `LEVENSHTEIN_BUFFER_SIZE` and `sharedLevenshteinBuffer`. Hoisting the function without hoisting its dependencies causes a runtime `ReferenceError`.
**Action:** When refactoring functions to a higher scope to prevent closure recreation, always identify and include any free variables they depend on that were previously in the same scope.

## 2026-05-08 - Bitwise Packing for Bigrams
**Learning:** String allocations during `substring()` in hot loops (like generating bigrams for thousands of strings) create massive GC pressure.
**Action:** Replaced `.substring()` with `(s.charCodeAt(i) << 16) | s.charCodeAt(i + 1)` to pack two 16-bit characters into a single 32-bit integer, completely eliminating string allocation overhead in Jaccard similarity bigram sets.
