// 预编译正则表达式以提升性能
const REGEX_SPACES = /\s+/g;
const REGEX_EXCL = /[！!]/g;
const REGEX_Q = /[？?]/g;
const REGEX_PAREN_L = /[（(]/g;
const REGEX_PAREN_R = /[）)]/g;
const REGEX_DASH = /[－-]/g;

// 艺术家专用预编译正则
const REGEX_ARTIST_SEP = /[,，、&＆×x]/g;
const REGEX_ARTIST_FEAT = /feat\.?/gi;
const REGEX_ARTIST_CV = /cv[.:]?/gi;
const REGEX_ARTIST_PAREN = /[(（][^)）]*[)）]/g;

// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_SPACES, '') // 去除空格
        .replace(REGEX_EXCL, '!')
        .replace(REGEX_Q, '?')
        .replace(REGEX_PAREN_L, '(')
        .replace(REGEX_PAREN_R, ')')
        .replace(REGEX_DASH, '-');
};

// 辅助函数：计算艺术家相似度
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
