
## YYYY-MM-DD - [Title]
**Learning:** [Insight]
**Action:** [How to apply next time]

## 2025-03-04 - Fuzzysort vs Fuse.js Performance
**Learning:** In a dataset of ~2000 songs, `Fuse.js` took ~36s for 5000 queries, while `fuzzysort` took ~4.6s for the same load, making it roughly an order of magnitude faster. Furthermore, `fuzzysort` returns a negative score where numbers closer to 0 indicate better matches, and a threshold like `-1000` is useful for maintaining some leniency, whereas `Fuse.js` used a positive score (0-1) where lower was better.
**Action:** When working on Node.js search performance bottlenecks in large arrays, verify if `Fuse.js` is the root cause and consider replacing it with `fuzzysort`. Normalize the `fuzzysort` score via `Math.max(0, (score + 1000) / 1000)` to adapt to legacy logic expecting a 0-1 scale.
