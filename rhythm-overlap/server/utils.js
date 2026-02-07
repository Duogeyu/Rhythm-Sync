// 标准化标题用于精确匹配
const normalizeTitle = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/\s+/g, '') // 去除空格
        .replace(/[！!]/g, '!')
        .replace(/[？?]/g, '?')
        .replace(/[（(]/g, '(')
        .replace(/[）)]/g, ')')
        .replace(/[－-]/g, '-');
};

module.exports = {
    normalizeTitle
};
