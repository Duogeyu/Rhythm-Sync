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
    const sorted = [...tags].sort((a, b) =>
        (TAG_CONFIG[a]?.priority ?? 99) - (TAG_CONFIG[b]?.priority ?? 99)
    );
    return sorted[0];
}

export default function MatchCard({ match, onClick }: MatchCardProps) {
    const { t } = useTranslation();

    if (!match || !match.arcadeSong || !match.userSong) return null;

    const isExact = match.matchType === 'exact';
    const scorePercent = ((match.score || 0) * 100).toFixed(0);
    const tags = match.tags || [];
    const primaryTag = getPrimaryTag(tags);

    const category = safeString(match.arcadeSong.category, '');
    const title = safeString(match.arcadeSong.title, 'Unknown Title');
    const artist = safeString(match.arcadeSong.artist, 'Unknown Artist');
    const bpm = formatBpm(match.arcadeSong.bpm);
    const charts = match.arcadeSong.charts || [];
    const levels = match.arcadeSong.levels || [];

    return (
        <motion.div
            onClick={() => onClick(match)}
            className="group relative cursor-pointer"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            transition={appleSpring}
        >
            <div className={`
                relative bg-white/85 backdrop-blur-sm rounded-2xl overflow-hidden
                border border-white/50
                shadow-[0_2px_8px_rgba(0,0,0,0.04)]
                hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]
                transition-all duration-300
                ${isExact ? 'ring-1 ring-pink-200/60' : 'ring-1 ring-amber-200/60'}
            `}>
                <div className="flex p-3 gap-3">
                    {/* 封面区域 */}
                    <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0 shadow-sm ring-1 ring-black/5">
                        <img
                            src={match.userSong.coverUrl}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== match.arcadeSong.coverUrl && match.arcadeSong.coverUrl) {
                                    target.src = match.arcadeSong.coverUrl;
                                }
                            }}
                        />
                        {/* 游戏封面缩略图 */}
                        {match.arcadeSong.coverUrl && (
                            <div className="absolute -bottom-px -right-px w-6 h-6 rounded-tl-lg overflow-hidden border-t border-l border-white/80 shadow-sm">
                                <img
                                    src={match.arcadeSong.coverUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                            </div>
                        )}
                        {/* 匹配度分数 */}
                        <div className={`
                            absolute top-1 left-1 px-1.5 py-0.5 rounded-md
                            text-[10px] font-black text-white backdrop-blur-md
                            ${isExact ? 'bg-pink-500/85' : 'bg-amber-500/85'}
                        `}>
                            {scorePercent}%
                        </div>
                    </div>

                    {/* 信息区域 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                            {/* 标签行 */}
                            <div className="flex items-center gap-1 mb-1 flex-wrap">
                                {category && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 truncate max-w-[90px]">
                                        {category}
                                    </span>
                                )}
                                {primaryTag && (() => {
                                    const config = TAG_CONFIG[primaryTag];
                                    return (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${config?.bgColor || 'bg-gray-50'} ${config?.color || 'text-gray-600'}`}>
                                            {t(`tags.${primaryTag}`)}
                                        </span>
                                    );
                                })()}
                            </div>

                            {/* 歌曲标题 */}
                            <h4 className="font-bold text-slate-800 text-[13px] leading-snug line-clamp-1 group-hover:text-cyan-600 transition-colors" title={title}>
                                {title}
                            </h4>
                            {/* 艺术家 */}
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-medium" title={artist}>
                                {artist}
                            </p>
                        </div>

                        {/* 难度条 + BPM */}
                        <div className="flex items-center gap-0.5 mt-1.5">
                            {(charts.length > 0
                                ? charts
                                : levels.map((l: string | number, i: number) => ({
                                    level: l,
                                    difficulty: Object.keys(DIFFICULTY_COLORS)[i]
                                }))
                            ).slice(0, 5).map((c: { level: string | number; difficulty: string }, i: number) => (
                                <div
                                    key={i}
                                    className={`
                                        h-[18px] min-w-[22px] px-1 rounded
                                        flex items-center justify-center
                                        text-[9px] font-bold text-white
                                        ${getDifficultyBg(c.difficulty)}
                                    `}
                                >
                                    {c.level}
                                </div>
                            ))}
                            {bpm !== '-' && (
                                <span className="ml-auto text-[10px] font-medium text-slate-300 tabular-nums whitespace-nowrap">
                                    BPM {bpm}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
