## 2024-04-22 - Parallelize getIpLocation I/O
**Learning:** In endpoints that iterate over arrays (like log files or IP stats), sequential I/O requests (`getIpLocation`, `readFile`) significantly degrade latency due to blocking the loop on each iteration.
**Action:** Use `Promise.all` combined with `map` to parallelize independent asynchronous calls within loop iterations.
