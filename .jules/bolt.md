## 2024-05-14 - Optimize Levenshtein Distance Calculation
**Learning:** Inner loops of match APIs (`/api/match/stream/:sessionId`) allocate O(M*N) memory dynamically per iteration, causing huge GC spikes under load.
**Action:** Move distance calculation outside the handler and use a pre-allocated 1D `Uint16Array` to completely eliminate inner-loop memory allocation and lower space complexity to O(min(M, N)).
