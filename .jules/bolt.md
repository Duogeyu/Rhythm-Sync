## 2024-06-03 - RegExp Compilation Overhead
**Learning:** Compiling regular expressions inside frequently called normalization functions (`normalizeTitle`, `normalizeArtist`) adds significant overhead per request and stresses the GC.
**Action:** Extract and pre-compile regular expressions at the module scope using the `REGEX_` prefix.
