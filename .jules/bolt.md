## 2023-10-27 - [Optimize Levenshtein Distance Calculation]
**Learning:** In the Node.js backend, synchronous string matching algorithms like `levenshteinDistance` run single-threaded and block the event loop. The original implementation used a 2D matrix (`const matrix = []`), resulting in $O(N \times M)$ memory allocations and massive Garbage Collection (GC) overhead during bulk matching tasks.
**Action:** Always optimize dynamic programming matrix calculations in high-frequency Node.js loops by using an $O(N)$ 1D array approach combined with a globally shared `Uint16Array` buffer for standard lengths. Include a dynamic allocation fallback for inputs that exceed the buffer's maximum length.

## 2024-11-20 - [Avoid Inline Functions and Regexes in Hot Loops]
**Learning:** In `server/index.js`, string normalization functions (`normalizeTitle`, `normalizeArtist`) and their complex regular expressions were defined repeatedly within `forEach` and `map` loops, causing expensive runtime re-compilation of regular expressions and unnecessary garbage collection of function objects.
**Action:** Extract stateless utility functions and their regular expressions (using a `REGEX_` prefix) to the module level (e.g., in `server/utils.js`) to guarantee they are compiled and allocated only once at startup.
