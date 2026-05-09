// 预编译正则，避免循环中重复编译，显著提升性能
const REGEX_COMMON_SPACE = /\s+/g;
const REGEX_TITLE_EXCLAMATION = /[！!]/g;
const REGEX_TITLE_QUESTION = /[？?]/g;
const REGEX_TITLE_PAREN_LEFT = /[（(]/g;
const REGEX_TITLE_PAREN_RIGHT = /[）)]/g;
const REGEX_TITLE_DASH = /[－-]/g;

// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(REGEX_COMMON_SPACE, '') // 去除空格
        .replace(REGEX_TITLE_EXCLAMATION, '!')
        .replace(REGEX_TITLE_QUESTION, '?')
        .replace(REGEX_TITLE_PAREN_LEFT, '(')
        .replace(REGEX_TITLE_PAREN_RIGHT, ')')
        .replace(REGEX_TITLE_DASH, '-');
};

module.exports = {
    normalizeTitle
};
