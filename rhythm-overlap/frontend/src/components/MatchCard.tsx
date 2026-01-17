import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { appleSpring, DIFFICULTY_COLORS } from '../config/games';
import { safeString, formatBpm, getDifficultyBg } from '../utils/format';
import type { MatchItem, MatchTag } from '../services/api';

interface MatchCardProps {
    match: MatchItem;
    onClick: (match: MatchItem) => void;
}

// 标签配置
const TAG_CONFIG: Record<MatchTag, { color: string; bgColor: string; priority: number }> = {
    perfect_match: { color: 'text-pink-600', bgColor: 'bg-pink-50', priority: 0 },
    same_artist: { color: 'text-emerald-600', bgColor: 'bg-emerald-50', priority: 1 },
    similar_artist: { color: 'text-blue-600', bgColor: 'bg-blue-50', priority: 2 },
    different_artist: { color: 'text-amber-600', bgColor: 'bg-amber-50', priority: 3 },
    exact_title: { color: 'text-cyan-600', bgColor: 'bg-cyan-50', priority: 4 },
    similar_title: { color: 'text-purple-600', bgColor: 'bg-purple-50', priority: 5 },
};

// 获取要显示的主要标签（优先级最高的一个）
function getPrimaryTag(tags: MatchTag[]): MatchTag | null {
    if (!tags || tags.length === 0) return null;
    
    // 按优先级排序，返回最高优先级的标签
    const sorted = [...tags].sort((a, b) => 
        (TAG_CONFIG[a]?.priority ?? 99) - (TAG_CONFIG[b]?.priority ?? 99)
    );
    
    return sorted[0];
}

export default function MatchCard({ match, onClick }: MatchCardProps) {
    const { t } = useTranslation();
    
    // 防止无效数据导致渲染崩溃
    if (!match || !match.arcadeSong || !match.userSong) return null;

    const isExact = match.matchType === 'exact';
    const tags = match.tags || [];

    // 提取数据
    const category = safeString(match.arcadeSong.category, 'UNKNOWN');
    const title = safeString(match.arcadeSong.title, 'Unknown Title');
    const artist = safeString(match.arcadeSong.artist, 'Unknown Artist');
    const version = safeString(match.arcadeSong.version, '');
    const bpm = formatBpm(match.arcadeSong.bpm);
    const charts = match.arcadeSong.charts || [];
    const levels = match.arcadeSong.levels || [];

    return (
        <motion.div
            onClick={() => onClick(match)}
            className="group relative cursor-pointer"
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
            transition={appleSpring}
        >
            {/* 底部阴影 */}
            <div className="absolute inset-0 bg-slate-800/10 rounded-xl transform translate-y-1 blur-sm" />

            <div className={`
        relative bg-white rounded-xl overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-all
        ${isExact ? 'border-l-pink-500' : 'border-l-yellow-400'}
      `}>
                <div className="flex h-24">
                    {/* 左侧：封面区 */}
                    <div className="relative w-24 h-24 flex-shrink-0">
                        <img
                            src={match.userSong.coverUrl}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== match.arcadeSong.coverUrl && match.arcadeSong.coverUrl) {
                                    target.src = match.arcadeSong.coverUrl;
                                }
                            }}
                        />
                        {/* 游戏封面小图 */}
                        {match.arcadeSong.coverUrl && (
                            <div className="absolute bottom-0 right-0 w-8 h-8 shadow-lg z-10">
                                <img
                                    src={match.arcadeSong.coverUrl}
                                    className="w-full h-full object-cover border-t border-l border-white/50"
                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                            </div>
                        )}
                        {/* 匹配度徽章 */}
                        <div className={`absolute top-0 left-0 px-1.5 py-0.5 text-[9px] font-black text-white ${isExact ? 'bg-pink-500' : 'bg-yellow-500'}`}>
                            {((match.score || 0) * 100).toFixed(0)}%
                        </div>
                    </div>

                    {/* 中间：信息区 */}
                    <div className="flex-1 min-w-0 p-3 flex flex-col justify-between relative overflow-hidden">
                        {/* 背景装饰字 */}
                        <div className="absolute -right-4 -bottom-4 text-[4rem] font-black text-slate-50 opacity-50 pointer-events-none select-none z-0">
                            {category.split('&')[0]}
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-tight truncate max-w-[100px]">
                                    {category}
                                </span>
                                {version && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-50 text-cyan-600 truncate max-w-[80px]">
                                        {version}
                                    </span>
                                )}
                                {/* 匹配标签 - 显示优先级最高的标签 */}
                                {(() => {
                                    const primaryTag = getPrimaryTag(tags);
                                    if (!primaryTag) return null;
                                    const config = TAG_CONFIG[primaryTag];
                                    return (
                                        <span 
                                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${config?.bgColor || 'bg-gray-50'} ${config?.color || 'text-gray-600'}`}
                                        >
                                            {t(`tags.${primaryTag}`)}
                                        </span>
                                    );
                                })()}
                            </div>
                            <h4 className="font-black text-slate-800 text-sm leading-tight line-clamp-1 group-hover:text-cyan-600 transition-colors" title={title}>
                                {title}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 line-clamp-1 mt-0.5" title={artist}>
                                {artist}
                            </p>
                        </div>

                        {/* 难度条展示 - 更像游戏选歌条 */}
                        <div className="flex items-end gap-1 relative z-10 mt-1">
                            {(charts.length > 0 ? charts : levels.map((l: string | number, i: number) => ({ level: l, difficulty: Object.keys(DIFFICULTY_COLORS)[i] }))).slice(0, 5).map((c: { level: string | number; difficulty: string }, i: number) => (
                                <div
                                    key={i}
                                    className={`
                    h-4 min-w-[20px] px-1 rounded-sm flex items-center justify-center text-[9px] font-black text-white shadow-sm
                    ${getDifficultyBg(c.difficulty)}
                  `}
                                >
                                    {c.level}
                                </div>
                            ))}
                            {bpm !== '-' && (
                                <div className="ml-auto text-[9px] font-black text-slate-300">
                                    BPM {bpm}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
