const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_PAREN_LEFT = /[（(]/g;
const REGEX_PAREN_RIGHT = /[）)]/g;
const REGEX_HYPHEN = /[－-]/g;

// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '') // 去除空格
        .replace(REGEX_EXCLAMATION, '!')
        .replace(REGEX_QUESTION, '?')
        .replace(REGEX_PAREN_LEFT, '(')
        .replace(REGEX_PAREN_RIGHT, ')')
        .replace(REGEX_HYPHEN, '-');
};

const REGEX_SEPARATORS = /[,，、&＆×x]/g;
const REGEX_FEAT = /feat\.?/gi;
const REGEX_CV = /cv[.:]?/gi;
const REGEX_PARENTHESES_CONTENT = /[(（][^)）]*[)）]/g;

// 标准化艺术家用于精确匹配
const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_SEPARATORS, '') // 去除分隔符
        .replace(REGEX_FEAT, '')
        .replace(REGEX_CV, '')
        .replace(REGEX_PARENTHESES_CONTENT, ''); // 去除括号内容
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
