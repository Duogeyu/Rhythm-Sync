const REGEX_TITLE_SPACES = /\s+/g;
const REGEX_TITLE_EXCLAMATION = /[！!]/g;
const REGEX_TITLE_QUESTION = /[？?]/g;
const REGEX_TITLE_PAREN_OPEN = /[（(]/g;
const REGEX_TITLE_PAREN_CLOSE = /[）)]/g;
const REGEX_TITLE_DASH = /[－-]/g;

// ⚡ Bolt: Use pre-compiled RegExes to avoid recompilation overhead inside hot loops
// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_TITLE_SPACES, '') // 去除空格
        .replace(REGEX_TITLE_EXCLAMATION, '!')
        .replace(REGEX_TITLE_QUESTION, '?')
        .replace(REGEX_TITLE_PAREN_OPEN, '(')
        .replace(REGEX_TITLE_PAREN_CLOSE, ')')
        .replace(REGEX_TITLE_DASH, '-');
};

const REGEX_ARTIST_SPACES = /\s+/g;
const REGEX_ARTIST_SEP = /[,，、&＆×x]/g;
const REGEX_ARTIST_FEAT = /feat\.?/gi;
const REGEX_ARTIST_CV = /cv[.:]?/gi;
const REGEX_ARTIST_PAREN = /[(（][^)）]*[)）]/g;

// 标准化艺术家用于精确匹配
const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_ARTIST_SPACES, '')
        .replace(REGEX_ARTIST_SEP, '') // 去除分隔符
        .replace(REGEX_ARTIST_FEAT, '')
        .replace(REGEX_ARTIST_CV, '')
        .replace(REGEX_ARTIST_PAREN, ''); // 去除括号内容
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
