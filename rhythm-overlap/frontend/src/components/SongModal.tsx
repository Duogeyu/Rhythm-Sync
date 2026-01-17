import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Play, Pause, Music, ArrowRight } from 'lucide-react';
import { GAMES, DIFFICULTY_COLORS } from '../config/games';
import { getDifficultyBg } from '../utils/format';
import { getSongUrl, type MatchItem } from '../services/api';
import BpmVisualizer from './BpmVisualizer';

interface SongModalProps {
    match: MatchItem;
    onClose: () => void;
}

export default function SongModal({ match, onClose }: SongModalProps) {
    const { t } = useTranslation();
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showDsIndex, setShowDsIndex] = useState<number | null>(null); // 点击显示 DS 的索引
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (match) {
            // 重置播放状态
            setAudioUrl(null);
            setIsPlaying(false);

            getSongUrl(match.userSong.id).then(res => {
                if (res && res.url) setAudioUrl(res.url);
            });
        }
        return () => {
            if (audioRef.current) audioRef.current.pause();
        }
    }, [match]);

    const togglePlay = () => {
        if (!audioRef.current || !audioUrl) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    if (!match) return null;

    // 获取数据
    const charts = match.arcadeSong.charts || [];
    const levels = match.arcadeSong.levels || [];
    const ds = match.arcadeSong.ds || [];
    const rawBpm = match.arcadeSong.bpm;
    // 处理 BPM：如果是数字直接用，如果是字符串尝试解析，失败则默认 120
    let bpmValue = 120;
    if (typeof rawBpm === 'number') {
        bpmValue = rawBpm;
    } else if (typeof rawBpm === 'string') {
        const parsed = parseInt(rawBpm);
        if (!isNaN(parsed)) bpmValue = parsed;
    } else if (typeof rawBpm === 'object' && rawBpm !== null) {
        // 处理 {min, max} 对象
        const bpmObj = rawBpm as { min?: number; max?: number };
        if (bpmObj.max) bpmValue = bpmObj.max;
    }

    // 难度列表数据准备
    const difficultyList = charts.length > 0 ? charts : levels.map((lv: string | number, i: number) => ({
        difficulty: Object.keys(DIFFICULTY_COLORS)[i] || `Level ${i + 1}`,
        level: lv,
        ds: ds[i] || 0
    }));

    // 根据后端返回的 gameId 选择游戏配置
    const gameId = match.arcadeSong.gameId || 'maimai'; // 默认 maimai
    const gameConfig = GAMES.find(g => g.id === gameId) || GAMES[0];

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
            style={{ overflowY: 'auto' }}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                layoutId={`card-${match.userSong.id}`}
                className="relative w-full max-w-3xl bg-white shadow-2xl rounded-3xl overflow-hidden flex flex-col md:flex-row z-10 my-auto"
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="absolute top-4 right-4 z-30 w-8 h-8 bg-black/10 hover:bg-black/20 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors backdrop-blur-md"
                >
                    <X size={20} strokeWidth={3} />
                </button>

                {/* 左侧：封面 + 游戏Logo */}
                <div className="relative w-full md:w-72 h-72 md:h-auto flex-shrink-0 bg-slate-100 group">
                    <img
                        src={match.arcadeSong.coverUrl || match.userSong.coverUrl}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== match.userSong.coverUrl) {
                                target.src = match.userSong.coverUrl;
                            }
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    {/* 游戏 Logo - 右上角 */}
                    <div className="absolute top-3 left-3 right-12">
                        <img
                            src={gameConfig.logoUrl}
                            alt={gameConfig.name}
                            className="h-10 w-auto object-contain drop-shadow-lg"
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                        />
                    </div>

                    {/* 左下角：分类 */}
                    <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-1">{t('detail.category')}</div>
                        <div className="text-white text-lg font-black leading-tight drop-shadow-md">
                            {match.arcadeSong.category || t('common.unknown')}
                        </div>
                    </div>
                </div>

                {/* 右侧：详细信息 */}
                <div className="flex-1 p-6 md:p-8 flex flex-col min-w-0 bg-white relative overflow-y-auto max-h-[80vh] md:max-h-none">
                    {/* 原始歌曲信息（网易云） */}
                    <div className="mb-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Music size={14} className="text-red-400" />
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">{t('detail.originalSong')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <img 
                                src={match.userSong.coverUrl} 
                                className="w-12 h-12 rounded-lg object-cover border-2 border-white shadow-sm flex-shrink-0" 
                            />
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-700 text-sm truncate" title={match.userSong.name}>
                                    {match.userSong.name}
                                </p>
                                <p className="text-xs text-slate-500 truncate" title={match.userSong.artists}>
                                    {match.userSong.artists}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 匹配箭头 */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-slate-200" />
                        <div className="flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full">
                            <ArrowRight size={14} className="text-slate-400" />
                            <span className={`text-xs font-black ${match.matchType === 'exact' ? 'text-pink-500' : 'text-yellow-500'}`}>
                                {((match.score || 0) * 100).toFixed(0)}% {t('detail.match')}
                            </span>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-slate-200 to-slate-200" />
                    </div>

                    {/* 街机歌曲标题区 */}
                    <div className="mb-4 pr-8">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-wider">{t('detail.arcadeSong')}</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight mb-2 line-clamp-2" title={match.arcadeSong.title}>
                            {match.arcadeSong.title}
                        </h2>
                        <p className="text-sm font-bold text-slate-500 line-clamp-1" title={match.arcadeSong.artist}>
                            {match.arcadeSong.artist}
                        </p>
                    </div>

                    {/* 核心数据栏 */}
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                        <BpmVisualizer bpm={bpmValue} />
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">{t('detail.version')}</div>
                            <div className="text-xs font-black text-slate-700 truncate max-w-[120px]">{match.arcadeSong.version || '-'}</div>
                        </div>
                    </div>

                    {/* 难度展示区 - 游戏风格 */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('detail.difficulty')}</h3>
                            {match.arcadeSong.type && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded text-white ${match.arcadeSong.type === 'DX' ? 'bg-orange-400' : 'bg-blue-400'}`}>
                                    {match.arcadeSong.type}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {difficultyList.length > 0 ? (
                                difficultyList.map((chart: { difficulty: string; level: string | number; ds?: number; notes?: number }, i: number) => (
                                    <div
                                        key={i}
                                        className={`
                                            relative flex flex-col items-center justify-center w-12 h-12 rounded-xl shadow-sm border-2 border-white ring-1 ring-slate-100
                                            ${getDifficultyBg(chart.difficulty)} text-white overflow-hidden group hover:scale-105 transition-transform cursor-pointer select-none
                                        `}
                                        title={`${chart.difficulty} ${chart.notes ? `(${chart.notes} notes)` : ''}`}
                                        onClick={() => setShowDsIndex(showDsIndex === i ? null : i)}
                                    >
                                        <div className="absolute top-0 inset-x-0 h-1/2 bg-white/10" />
                                        <div className="text-[8px] font-bold uppercase opacity-90 relative z-10 translate-y-[-1px]">
                                            {chart.difficulty.substring(0, 3)}
                                        </div>
                                        <div className="text-lg font-black leading-none relative z-10 shadow-black drop-shadow-sm">
                                            {chart.level}
                                        </div>
                                        {chart.ds && chart.ds > 0 && showDsIndex === i && (
                                            <div className="absolute bottom-0.5 text-[7px] font-bold bg-black/50 px-1 rounded-full animate-fade-in">
                                                {typeof chart.ds === 'number' ? chart.ds.toFixed(1) : chart.ds}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-slate-400 italic py-2">
                                    {t('detail.noDifficultyData', '暂无难度数据')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 底部功能栏 */}
                    <div className="mt-auto pt-4 border-t border-slate-100 flex gap-3">
                        <button
                            onClick={togglePlay}
                            disabled={!audioUrl}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-black text-sm
                                ${audioUrl
                                    ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200 active:scale-[0.98]'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                            <span>{audioUrl ? (isPlaying ? 'PAUSE' : 'PLAY') : 'NO PREVIEW'}</span>
                        </button>
                    </div>
                    <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => setIsPlaying(false)} />
                </div>
            </motion.div>
        </motion.div>
    );
}
