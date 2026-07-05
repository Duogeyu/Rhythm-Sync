const REGEX_SPACES = /\s+/g;
const REGEX_EXCLAMATION = /[！!]/g;
const REGEX_QUESTION = /[？?]/g;
const REGEX_LEFT_PAREN = /[（(]/g;
const REGEX_RIGHT_PAREN = /[）)]/g;
const REGEX_DASH = /[－-]/g;

// 标准化标题用于精确匹配
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

module.exports = {
    normalizeTitle
};
