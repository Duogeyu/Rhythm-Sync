## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.

## 2024-04-29 - Optimize stringSimilarity Jaccard Bigram implementation
**Learning:** The `stringSimilarity` utility function used for matching fallback songs relies on Jaccard distance over string bigrams. It previously created many intermediate string objects (`s.substring`) and iterated over them using string Sets. Using a 32-bit integer encoding for character bigrams (`(a.charCodeAt(i) << 16) | a.charCodeAt(i+1)`) avoids string allocations entirely and executes ~50% faster while remaining logically identical.
**Action:** Replace string bigram generation with bitwise character code encoding in Jaccard similarity algorithms.
