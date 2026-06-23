const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_LEFT_PAREN = /[（(]/g;
const REGEX_RIGHT_PAREN = /[）)]/g;
const REGEX_DASH = /[－-]/g;

// 标准化标题用于精确匹配
// ⚡ BOLT: Pre-compile regular expressions to prevent repeated recompilation during high-frequency string normalization loop, reducing GC overhead and CPU usage.
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '') // 去除空格
        .replace(REGEX_EXCLAMATION, '!')
        .replace(REGEX_QUESTION, '?')
        .replace(REGEX_LEFT_PAREN, '(')
        .replace(REGEX_RIGHT_PAREN, ')')
        .replace(REGEX_DASH, '-');
};

const REGEX_ARTIST_SPACES = /\s+/g;
const REGEX_ARTIST_SEPARATORS = /[,，、&＆×x]/g;
const REGEX_ARTIST_FEAT = /feat\.?/gi;
const REGEX_ARTIST_CV = /cv[.:]?/gi;
const REGEX_ARTIST_PARENS = /[(（][^)）]*[)）]/g;

// ⚡ BOLT: Pre-compile regular expressions for artist normalization as well to prevent repeated recompilation, reducing GC overhead and CPU usage.
const normalizeArtist = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_ARTIST_SPACES, '')
        .replace(REGEX_ARTIST_SEPARATORS, '') // 去除分隔符
        .replace(REGEX_ARTIST_FEAT, '')
        .replace(REGEX_ARTIST_CV, '')
        .replace(REGEX_ARTIST_PARENS, ''); // 去除括号内容
};

module.exports = {
    normalizeTitle,
    normalizeArtist
};
