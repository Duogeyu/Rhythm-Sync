
## 2026-03-10 - [Optimize Levenshtein Distance Spatial Complexity]
**Learning:** The previous Levenshtein Distance implementation used a full 2D array (size $M \times N$) dynamically allocated upon each call. During batch fuzzy string matching within `fetchGameSongs`, this generated massive GC pressure, slowing the Node event loop.
**Action:** Replace $O(MN)$ string distance functions with $O(\min(M, N))$ implementations using a 1D `Uint16Array` configured globally, keeping memory footprint low and flat, especially across loops.
