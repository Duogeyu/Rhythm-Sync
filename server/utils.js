// 预编译正则表达式以提升性能
const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_PAREN_OPEN = /[（(]/g;
const REGEX_PAREN_CLOSE = /[）)]/g;
const REGEX_DASH = /[－-]/g;

const REGEX_SEPARATORS = /[,，、&＆×x]/g;
const REGEX_FEAT = /feat\.?/gi;
const REGEX_CV = /cv[.:]?/gi;
const REGEX_PARENS_CONTENT = /[(（][^)）]*[)）]/g;

// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '') // 去除空格
        .replace(REGEX_EXCLAMATION, '!')
        .replace(REGEX_QUESTION, '?')
        .replace(REGEX_PAREN_OPEN, '(')
        .replace(REGEX_PAREN_CLOSE, ')')
        .replace(REGEX_DASH, '-');
};

// 标准化艺术家用于精确匹配
const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_SEPARATORS, '') // 去除分隔符
        .replace(REGEX_FEAT, '')
        .replace(REGEX_CV, '')
        .replace(REGEX_PARENS_CONTENT, ''); // 去除括号内容
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
