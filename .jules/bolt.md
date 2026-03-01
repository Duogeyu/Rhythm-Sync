
## 2025-03-09 - Levenshtein Distance Memory & Speed Optimization
**Learning:** In fuzzy string matching algorithms like Levenshtein distance, using an O(n*m) 2D array Matrix allocation causes extremely high Garbage Collection pressure and performance degradation in Node.js, especially when called inside tight loops. Replacing the 2D `Array` with a single 1D `Uint16Array` (and inlining Math.min) mitigates this memory overhead and drastically improves execution speed (by around ~3x in local benchmarks).
**Action:** Next time when implementing or reviewing dynamic programming algorithms like Levenshtein distance in hot paths, ensure that the space complexity is optimized to O(min(N,M)) with `TypedArrays` to avoid stressing the V8 garbage collector.
