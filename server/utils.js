// 标准化标题用于精确匹配
const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_LPAREN = /[（(]/g;
const REGEX_RPAREN = /[）)]/g;
const REGEX_DASH = /[－-]/g;

// 艺术家标准化特有正则
const REGEX_ARTIST_SEPARATORS = /[,，、&＆×x]/g;
const REGEX_FEAT = /feat\.?/gi;
const REGEX_CV = /cv[.:]?/gi;
const REGEX_PAREN_CONTENT = /[(（][^)）]*[)）]/g;

const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '') // 去除空格
        .replace(REGEX_EXCLAMATION, '!')
        .replace(REGEX_QUESTION, '?')
        .replace(REGEX_LPAREN, '(')
        .replace(REGEX_RPAREN, ')')
        .replace(REGEX_DASH, '-');
};

const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_ARTIST_SEPARATORS, '') // 去除分隔符
        .replace(REGEX_FEAT, '')
        .replace(REGEX_CV, '')
        .replace(REGEX_PAREN_CONTENT, ''); // 去除括号内容
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
