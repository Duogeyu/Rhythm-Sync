function original(s1, s2) {
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    const matrix = [];
    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // 替换
                    matrix[i][j - 1] + 1,     // 插入
                    matrix[i - 1][j] + 1      // 删除
                );
            }
        }
    }
    return matrix[s2.length][s1.length];
}

const MAX_LEN = 1024;
const dpBuffer = new Uint16Array(MAX_LEN + 1);

function optimized(s1, s2) {
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    // ensure s1 is the shorter one to minimize memory usage
    if (s1.length > s2.length) {
        const temp = s1;
        s1 = s2;
        s2 = temp;
    }

    const m = s1.length;
    const n = s2.length;

    let dp;
    if (m <= MAX_LEN) {
        dp = dpBuffer;
    } else {
        dp = new Uint16Array(m + 1);
    }

    for (let i = 0; i <= m; i++) {
        dp[i] = i;
    }

    for (let i = 1; i <= n; i++) {
        let prev = dp[0];
        dp[0] = i;
        const char2 = s2.charAt(i - 1);
        for (let j = 1; j <= m; j++) {
            const temp = dp[j];
            if (char2 === s1.charAt(j - 1)) {
                dp[j] = prev;
            } else {
                dp[j] = Math.min(
                    dp[j - 1] + 1,
                    dp[j] + 1,
                    prev + 1
                );
            }
            prev = temp;
        }
    }

    return dp[m];
}

const testCases = [
    ["", ""],
    ["a", ""],
    ["", "b"],
    ["kitten", "sitting"],
    ["flaw", "lawn"],
    ["abcdefg", "bcdefgh"],
    ["hello", "world"]
];

for (const [s1, s2] of testCases) {
    const o = original(s1, s2);
    const op = optimized(s1, s2);
    if (o !== op) {
        console.error(`Failed on "${s1}" vs "${s2}": expected ${o}, got ${op}`);
        process.exit(1);
    }
}
console.log("All tests pass!");
