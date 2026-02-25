import { DIFFICULTY_COLORS } from '../config/games';

// 安全字符串转换：处理可能是对象的字段
export const safeString = (value: unknown, fallback = ''): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
        // 处理 {min, max} 格式的 BPM
        if ('min' in value || 'max' in value) {
            const obj = value as { min?: number; max?: number };
            return `${obj.min || '?'}-${obj.max || '?'}`;
        }
        // 其他对象尝试转为 JSON 字符串
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    }
    return String(value);
};

// 格式化 BPM 值（处理太鼓等游戏的 {min, max} 对象格式）
export const formatBpm = (bpm: unknown): string => {
    if (!bpm) return '-';
    if (typeof bpm === 'object' && bpm !== null) {
        if ('min' in bpm && 'max' in bpm) {
            const obj = bpm as { min: number; max: number };
            return obj.min === obj.max ? String(obj.min) : `${obj.min}-${obj.max}`;
        }
        return '-';
    }
    return String(bpm);
};

// 根据难度获取背景颜色
export const getDifficultyBg = (diff: string): string => {
    return DIFFICULTY_COLORS[diff] || 'bg-slate-400';
};
