// 预编译正则表达式以提升性能
const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_PARENTHESIS_LEFT = /[（(]/g;
const REGEX_PARENTHESIS_RIGHT = /[）)]/g;
const REGEX_DASH = /[－-]/g;

// 预编译 artist 正则表达式
const REGEX_ARTIST_SEPARATORS = /[,，、&＆×x]/g;
const REGEX_ARTIST_FEAT = /feat\.?/gi;
const REGEX_ARTIST_CV = /cv[.:]?/gi;
const REGEX_ARTIST_PARENTHESES = /[(（][^)）]*[)）]/g;

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

const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_ARTIST_SEPARATORS, '')
        .replace(REGEX_ARTIST_FEAT, '')
        .replace(REGEX_ARTIST_CV, '')
        .replace(REGEX_ARTIST_PARENTHESES, '');
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
