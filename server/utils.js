const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_PAREN_LEFT = /[（(]/g;
const REGEX_PAREN_RIGHT = /[）)]/g;
const REGEX_DASH = /[－-]/g;

const REGEX_ARTIST_SEP = /[,，、&＆×x]/g;
const REGEX_ARTIST_FEAT = /feat\.?/gi;
const REGEX_ARTIST_CV = /cv[.:]?/gi;
const REGEX_ARTIST_PAREN = /[(（][^)）]*[)）]/g;

// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '') // 去除空格
        .replace(REGEX_EXCLAMATION, '!')
        .replace(REGEX_QUESTION, '?')
        .replace(REGEX_PAREN_LEFT, '(')
        .replace(REGEX_PAREN_RIGHT, ')')
        .replace(REGEX_DASH, '-');
};

const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '')
        .replace(REGEX_ARTIST_SEP, '') // 去除分隔符
        .replace(REGEX_ARTIST_FEAT, '')
        .replace(REGEX_ARTIST_CV, '')
        .replace(REGEX_ARTIST_PAREN, ''); // 去除括号内容
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
