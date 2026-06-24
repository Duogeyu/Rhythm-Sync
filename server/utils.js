// ⚡ Bolt Optimization: Hoisted string normalization utility functions and pre-compiled regex constants to avoid recompilation and repeated GC allocation during matching requests.
const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_PARENTHESIS_LEFT = /[（(]/g;
const REGEX_PARENTHESIS_RIGHT = /[）)]/g;
const REGEX_DASH = /[－-]/g;

// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_EXCLAMATION, '!')
        .replace(REGEX_QUESTION, '?')
        .replace(REGEX_PARENTHESIS_LEFT, '(')
        .replace(REGEX_PARENTHESIS_RIGHT, ')')
        .replace(REGEX_DASH, '-');
};

const REGEX_ARTIST_SEPARATORS = /[,，、&＆×x]/g;
const REGEX_ARTIST_FEAT = /feat\.?/gi;
const REGEX_ARTIST_CV = /cv[.:]?/gi;
const REGEX_ARTIST_PARENTHESES = /[(（][^)）]*[)）]/g;

// 辅助函数：计算艺术家相似度
const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_ARTIST_SEPARATORS, '')
        .replace(REGEX_ARTIST_FEAT, '')
        .replace(REGEX_ARTIST_CV, '')
        .replace(REGEX_ARTIST_PARENTHESES, '');
};

const REGEX_NON_ALPHANUM = /[^a-z0-9\u4e00-\u9fa5]+/;

const artistMatch = (userArtist, gameArtist) => {
    const ua = normalizeArtist(userArtist);
    const ga = normalizeArtist(gameArtist);
    // 无法判断时给较低分数，避免误匹配
    if (!ua || !ga) return 0.3;
    if (ua === ga) return 1.0;
    // 完全包含关系
    if (ua.includes(ga) || ga.includes(ua)) return 0.85;
    // 检查是否有共同的艺术家名片段（至少3个字符）
    const uaParts = ua.split(REGEX_NON_ALPHANUM).filter(p => p.length >= 3);
    const gaParts = ga.split(REGEX_NON_ALPHANUM).filter(p => p.length >= 3);
    for (const up of uaParts) {
        for (const gp of gaParts) {
            if (up === gp) return 0.7;
            if (up.includes(gp) || gp.includes(up)) return 0.5;
        }
    }
    return 0.1; // 降低完全不匹配的分数
};

// 计算标题长度相似度（避免短标题误匹配长标题）
const lengthSimilarity = (str1, str2) => {
    const len1 = str1.length;
    const len2 = str2.length;
    if (len1 === 0 || len2 === 0) return 0;
    const ratio = Math.min(len1, len2) / Math.max(len1, len2);
    return ratio;
};

module.exports = {
    normalizeTitle,
    normalizeArtist,
    artistMatch,
    lengthSimilarity
};
