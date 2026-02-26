// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/\s+/g, '') // 去除空格
        .replace(/[！!]/g, '!')
        .replace(/[？?]/g, '?')
        .replace(/[（(]/g, '(')
        .replace(/[）)]/g, ')')
        .replace(/[－-]/g, '-');
};

// Levenshtein 编辑距离 (内存优化版 O(min(M,N)) space)
const levenshteinDistance = (s1, s2) => {
    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    // Ensure s1 is the shorter string to minimize memory usage
    if (s1.length > s2.length) {
        [s1, s2] = [s2, s1];
    }

    const s1Len = s1.length;
    const s2Len = s2.length;

    // Two rows of distance values
    let previous = new Array(s1Len + 1);
    let current = new Array(s1Len + 1);

    // Initialize first row (0 to s1Len)
    for (let j = 0; j <= s1Len; j++) {
        previous[j] = j;
    }

    for (let i = 1; i <= s2Len; i++) {
        current[0] = i; // First element of current row is the row index
        const s2Char = s2.charCodeAt(i - 1);

        for (let j = 1; j <= s1Len; j++) {
            const cost = s1.charCodeAt(j - 1) === s2Char ? 0 : 1;

            // deletion, insertion, substitution
            current[j] = Math.min(
                previous[j] + 1,      // deletion (up)
                current[j - 1] + 1,   // insertion (left)
                previous[j - 1] + cost // substitution (diagonal)
            );
        }

        // Swap arrays (avoid allocation)
        const temp = previous;
        previous = current;
        current = temp;
    }

    return previous[s1Len];
};

module.exports = {
    normalizeTitle,
    levenshteinDistance
};
