const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_PARENTHESIS_LEFT = /[（(]/g;
const REGEX_PARENTHESIS_RIGHT = /[）)]/g;
const REGEX_DASH = /[－-]/g;

const REGEX_ARTIST_SEPARATORS = /[,，、&＆×x]/g;
const REGEX_FEAT = /feat\.?/gi;
const REGEX_CV = /cv[.:]?/gi;
const REGEX_BRACKETS_CONTENT = /[(（][^)）]*[)）]/g;

// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '') // 去除空格
        .replace(REGEX_EXCLAMATION, '!')
        .replace(REGEX_QUESTION, '?')
        .replace(REGEX_PARENTHESIS_LEFT, '(')
        .replace(REGEX_PARENTHESIS_RIGHT, ')')
        .replace(REGEX_DASH, '-');
};

const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_ARTIST_SEPARATORS, '') // 去除分隔符
        .replace(REGEX_FEAT, '')
        .replace(REGEX_CV, '')
        .replace(REGEX_BRACKETS_CONTENT, ''); // 去除括号内容
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
