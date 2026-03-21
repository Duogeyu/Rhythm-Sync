
## 2025-03-02 - Optimize Levenshtein Distance Calculation
**Learning:** Inner loop calculations involving large 2D matrix allocations (O(N*M)) inside route handlers create significant memory and GC pressure, particularly under load.
**Action:** Always consider converting standard algorithms into space-optimized O(min(M, N)) variants using primitive typed arrays (like `Uint16Array`) hoisted outside route handlers, drastically reducing reallocation and scaling much better.
