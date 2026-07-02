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



const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[,，、&＆×x]/g, '') // 去除分隔符
        .replace(/feat\.?/gi, '')
        .replace(/cv[.:]?/gi, '')
        .replace(/[(（][^)）]*[)）]/g, ''); // 去除括号内容
};

const LEVENSHTEIN_BUFFER_SIZE = 1024;
const sharedLevenshteinBuffer = new Uint16Array(LEVENSHTEIN_BUFFER_SIZE);

// Levenshtein 编辑距离 (优化版：O(n) 空间，减少 GC)
const levenshteinDistance = (s1, s2) => {
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    // 如果字符串过长，回退到动态分配数组，避免越界
    if (len1 >= LEVENSHTEIN_BUFFER_SIZE) {
        const row = new Uint16Array(len1 + 1);
        for (let j = 0; j <= len1; j++) {
            row[j] = j;
        }
        for (let i = 1; i <= len2; i++) {
            let prev = i;
            let prevDiagonal = i - 1;
            const c2 = s2.charCodeAt(i - 1);
            for (let j = 1; j <= len1; j++) {
                let current;
                if (c2 === s1.charCodeAt(j - 1)) {
                    current = prevDiagonal;
                } else {
                    current = Math.min(
                        prevDiagonal, // 替换
                        prev,         // 插入
                        row[j]        // 删除
                    ) + 1;
                }
                prevDiagonal = row[j];
                row[j] = current;
                prev = current;
            }
        }
        return row[len1];
    }

    // 使用共享 buffer 以减少 GC 压力
    for (let j = 0; j <= len1; j++) {
        sharedLevenshteinBuffer[j] = j;
    }
    for (let i = 1; i <= len2; i++) {
        let prev = i;
        let prevDiagonal = i - 1;
        const c2 = s2.charCodeAt(i - 1);
        for (let j = 1; j <= len1; j++) {
            let current;
            if (c2 === s1.charCodeAt(j - 1)) {
                current = prevDiagonal;
            } else {
                current = Math.min(
                    prevDiagonal,
                    prev,
                    sharedLevenshteinBuffer[j]
                ) + 1;
            }
            prevDiagonal = sharedLevenshteinBuffer[j];
            sharedLevenshteinBuffer[j] = current;
            prev = current;
        }
    }
    return sharedLevenshteinBuffer[len1];
};

module.exports = {
    normalizeTitle,
    normalizeArtist,
    levenshteinDistance
};
