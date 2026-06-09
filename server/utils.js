// 预编译正则表达式以优化性能
const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_PAREN_OPEN = /[（(]/g;
const REGEX_PAREN_CLOSE = /[）)]/g;
const REGEX_DASH = /[－-]/g;

const REGEX_ARTIST_SEPARATORS = /[,，、&＆×x]/g;
const REGEX_FEAT = /feat\.?/gi;
const REGEX_CV = /cv[.:]?/gi;
const REGEX_PARENS = /[(（][^)）]*[)）]/g;

// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_EXCLAMATION, '!')
        .replace(REGEX_QUESTION, '?')
        .replace(REGEX_PAREN_OPEN, '(')
        .replace(REGEX_PAREN_CLOSE, ')')
        .replace(REGEX_DASH, '-');
};

// 辅助函数：计算艺术家相似度
const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_ARTIST_SEPARATORS, '')
        .replace(REGEX_FEAT, '')
        .replace(REGEX_CV, '')
        .replace(REGEX_PARENS, '');
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
