// 游戏配置
// Logo 存放在 /public/logos/ 目录下
// 机台图片存放在 /public/logos/cabinets/ 目录下
// 占位机台图片: cabinet-placeholder.png (来自华立官网)
export const GAMES = [
    {
        id: 'maimai',
        name: 'maimai DX (国际)',
        shortName: '国际',
        color: 'from-blue-400 to-cyan-400',
        ringColor: '#22d3ee',
        logoUrl: '/logos/maimai-intl.png',
        cabinetUrl: '/logos/cabinets/cabinet-placeholder.png'
    },
    {
        id: 'maimai-jp',
        name: 'maimai DX (日服)',
        shortName: '日服',
        color: 'from-cyan-400 to-blue-500',
        ringColor: '#06b6d4',
        logoUrl: '/logos/maimai-jp.png',
        cabinetUrl: '/logos/cabinets/cabinet-placeholder.png'
    },
    {
        id: 'maimai-cn',
        name: 'maimai DX (国服)',
        shortName: '国服',
        color: 'from-orange-400 to-red-400',
        ringColor: '#fb923c',
        logoUrl: '/logos/maimai-cn.png',
        cabinetUrl: '/logos/cabinets/cabinet-placeholder.png'
    },
    {
        id: 'chunithm',
        name: 'CHUNITHM (国际)',
        shortName: '国际',
        color: 'from-yellow-400 to-yellow-600',
        ringColor: '#facc15',
        logoUrl: '/logos/chunithm-intl.png',
        cabinetUrl: '/logos/cabinets/chunithm-cn-cabinet.png'
    },
    {
        id: 'chunithm-jp',
        name: 'CHUNITHM (日服)',
        shortName: '日服',
        color: 'from-amber-400 to-orange-500',
        ringColor: '#fbbf24',
        logoUrl: '/logos/chunithm-jp.webp',
        cabinetUrl: '/logos/cabinets/chunithm-cn-cabinet.png'
    },
    {
        id: 'ongeki',
        name: 'ONGEKI (日服)',
        shortName: '日服',
        color: 'from-pink-400 to-purple-500',
        ringColor: '#e879f9',
        logoUrl: '/logos/ongeki.webp',
        cabinetUrl: '/logos/cabinets/ongeki-cabinet.png'
    },
    {
        id: 'taiko',
        name: '太鼓の達人',
        shortName: '太鼓',
        color: 'from-red-500 to-red-700',
        ringColor: '#ef4444',
        logoUrl: '/logos/taiko.png',
        cabinetUrl: '/logos/cabinets/taiko-cn-cabinet.png'
    },
];

export type GameConfig = typeof GAMES[0];

// 动画配置
export const iosEase: [number, number, number, number] = [0.36, 0.66, 0.04, 1];
export const appleSpring = { type: "spring" as const, stiffness: 350, damping: 35, mass: 1 };

export const containerStagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

export const itemPop = {
    hidden: { y: 20, opacity: 0, scale: 0.95 },
    visible: { y: 0, opacity: 1, scale: 1, transition: appleSpring }
};

// 难度颜色配置
export const DIFFICULTY_COLORS: Record<string, string> = {
    'Basic': 'bg-green-500',
    'Advanced': 'bg-yellow-500',
    'Expert': 'bg-red-500',
    'Master': 'bg-purple-500',
    'Re:Master': 'bg-fuchsia-400',
    'Ultima': 'bg-black',
    'Lunatic': 'bg-pink-500',
    'かんたん': 'bg-red-400',
    'ふつう': 'bg-yellow-500',
    'むずかしい': 'bg-green-500',
    'おに': 'bg-pink-600',
    '裏おに': 'bg-purple-600',
};
