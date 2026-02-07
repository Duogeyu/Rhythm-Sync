import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Play, Pause, Music, ArrowRight, Volume2, VolumeX, SkipBack, Loader2, Headphones, ChevronDown, ChevronUp, Gamepad2 } from 'lucide-react';
import { GAMES, DIFFICULTY_COLORS } from '../config/games';
import { getDifficultyBg } from '../utils/format';
import { getSongUrl, getSongChorus, getArcadeSongAudio, checkSongInGames, type MatchItem, type CrossGameMatch } from '../services/api';
import BpmVisualizer from './BpmVisualizer';

interface SongModalProps {
    match: MatchItem;
    onClose: () => void;
}

function estimateHighlightTime(durationMs?: number): number {
    if (!durationMs || durationMs <= 0) return 60;
    return Math.max(20, Math.min((durationMs / 1000) * 0.37, 80));
}

function formatTime(sec: number): string {
    if (!isFinite(sec) || sec < 0) return '0:00';
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
}

export default function SongModal({ match, onClose }: SongModalProps) {
    const { t } = useTranslation();

    // 用 matchKey 追踪当前歌曲，确保切歌或重新打开时正确重置
    const matchKey = `${match?.arcadeSong?.id}_${match?.userSong?.id}`;
    const prevMatchKey = useRef('');

    // === 音频状态 ===
    const [arcadeAudioUrl, setArcadeAudioUrl] = useState<string | null>(null);
    const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
    const [arcadeLoading, setArcadeLoading] = useState(true);
    const [userLoading, setUserLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [showVolume, setShowVolume] = useState(false);
    const [activeSource, setActiveSource] = useState<'arcade' | 'user'>('arcade');
    const [arcadeSourceInfo, setArcadeSourceInfo] = useState('');

    // === "更多"区域 ===
    const [showMore, setShowMore] = useState(false);
    const [crossGameData, setCrossGameData] = useState<Record<string, CrossGameMatch> | null>(null);
    const [crossGameLoading, setCrossGameLoading] = useState(false);

    // === UI ===
    const [showDsIndex, setShowDsIndex] = useState<number | null>(null);

    // === Refs ===
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const chorusStartRef = useRef<number | null>(null);
    const hasAutoPlayed = useRef(false);
    const progressRef = useRef<HTMLDivElement>(null);
    // 用于清理 audio 事件
    const cleanupRef = useRef<(() => void) | null>(null);

    const isLoading = arcadeLoading && userLoading;
    const hasAnyAudio = !!(arcadeAudioUrl || userAudioUrl);

    // ====== 清理音频 ======
    const cleanupAudio = useCallback(() => {
        if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
        const audio = audioRef.current;
        if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    }, []);

    // ====== 数据获取（matchKey 变化时重置一切） ======
    useEffect(() => {
        if (!match || matchKey === prevMatchKey.current) return;
        prevMatchKey.current = matchKey;

        // 重置所有状态
        cleanupAudio();
        setArcadeAudioUrl(null);
        setUserAudioUrl(null);
        setArcadeLoading(true);
        setUserLoading(true);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setActiveSource('arcade');
        setArcadeSourceInfo('');
        setShowMore(false);
        setCrossGameData(null);
        hasAutoPlayed.current = false;
        chorusStartRef.current = null;

        const arcadeSong = match.arcadeSong;
        let arcadeNeteaseId: number | null = null;

        // 1. 街机原曲搜索
        getArcadeSongAudio(
            arcadeSong.gameId || 'maimai', String(arcadeSong.id),
            arcadeSong.title, arcadeSong.artist
        ).then(res => {
            if (res?.url) {
                setArcadeAudioUrl(res.url);
                arcadeNeteaseId = res.neteaseId;
                const srcLabel = res.source === 'qqmusic' ? 'QQ音乐' : '网易云';
                setArcadeSourceInfo(`${srcLabel}: ${res.matchedTitle}`);

                // 用街机原曲的网易云 ID 查高潮（这才是对的歌）
                if (res.neteaseId) {
                    getSongChorus(res.neteaseId).then(c => {
                        if (c?.startTime != null) chorusStartRef.current = c.startTime / 1000;
                    }).catch(() => {});
                }
            }
        }).catch(() => {}).finally(() => setArcadeLoading(false));

        // 2. 用户歌单版本
        getSongUrl(match.userSong.id).then(res => {
            if (res?.url) setUserAudioUrl(res.url);
        }).catch(() => {}).finally(() => setUserLoading(false));

        // 3. 用户歌曲高潮（作为备用，万一街机原曲没有网易云 ID）
        getSongChorus(match.userSong.id).then(res => {
            // 只在街机原曲没有 neteaseId 时才用这个
            if (res?.startTime != null && !arcadeNeteaseId) {
                chorusStartRef.current = res.startTime / 1000;
            }
        }).catch(() => {});

        return cleanupAudio;
    }, [matchKey, match, cleanupAudio]);

    // ====== 自动播放（等两个源都加载完再决定用哪个） ======
    useEffect(() => {
        // 等两个都加载完（或至少街机原曲加载完，因为它是优先源）
        if (arcadeLoading) return;
        // 如果街机原曲有 URL，直接用；没有的话等用户音频也加载完
        if (!arcadeAudioUrl && userLoading) return;

        if (hasAutoPlayed.current) return;

        const url = arcadeAudioUrl || userAudioUrl;
        if (!url) return;

        const audio = audioRef.current;
        if (!audio) return;

        hasAutoPlayed.current = true;
        const isArcade = !!arcadeAudioUrl;
        setActiveSource(isArcade ? 'arcade' : 'user');

        console.log(`[SongModal] 自动播放: ${isArcade ? '街机原曲' : '用户歌曲'}`);
        loadAudioAndPlay(audio, url, chorusStartRef.current ?? estimateHighlightTime(match?.userSong?.duration));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [arcadeLoading, arcadeAudioUrl, userLoading, userAudioUrl]);

    // ====== 通用：加载音频并播放 ======
    function loadAudioAndPlay(audio: HTMLAudioElement, url: string, seekTo?: number) {
        // 清理旧事件
        if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }

        audio.pause();
        audio.src = url;
        audio.volume = volume;
        audio.load();

        const onMeta = () => {
            setDuration(audio.duration || 0);
            if (seekTo != null && seekTo > 0 && audio.duration > 0) {
                audio.currentTime = Math.min(seekTo, audio.duration - 5);
            }
        };
        const onCanPlay = () => {
            audio.removeEventListener('canplay', onCanPlay);
            audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        };
        const onTime = () => setCurrentTime(audio.currentTime);
        const onEnd = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', onMeta, { once: true });
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('ended', onEnd);

        cleanupRef.current = () => {
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('ended', onEnd);
        };
    }

    // ====== 操作 ======
    const playPreview = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) { audio.pause(); setIsPlaying(false); return; }
        const url = arcadeAudioUrl || userAudioUrl;
        if (!url) return;
        setActiveSource(arcadeAudioUrl ? 'arcade' : 'user');
        loadAudioAndPlay(audio, url, chorusStartRef.current ?? estimateHighlightTime(match?.userSong?.duration));
    };

    const playArcadeFromStart = () => {
        const audio = audioRef.current;
        if (!audio) return;
        const url = arcadeAudioUrl || userAudioUrl;
        if (!url) return;
        setActiveSource(arcadeAudioUrl ? 'arcade' : 'user');
        loadAudioAndPlay(audio, url, 0);
    };

    const playUserSong = () => {
        const audio = audioRef.current;
        if (!audio || !userAudioUrl) return;
        if (isPlaying && activeSource === 'user') { audio.pause(); setIsPlaying(false); return; }
        setActiveSource('user');
        loadAudioAndPlay(audio, userAudioUrl, 0);
    };

    const handleVolumeChange = (v: number) => {
        setVolume(v);
        if (audioRef.current) audioRef.current.volume = v;
    };

    const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !audioRef.current || duration <= 0) return;
        const ratio = Math.max(0, Math.min(1, (e.clientX - progressRef.current.getBoundingClientRect().left) / progressRef.current.getBoundingClientRect().width));
        audioRef.current.currentTime = ratio * duration;
        setCurrentTime(ratio * duration);
    };

    const handleProgressDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.buttons !== 1 || !progressRef.current || !audioRef.current || duration <= 0) return;
        const ratio = Math.max(0, Math.min(1, (e.clientX - progressRef.current.getBoundingClientRect().left) / progressRef.current.getBoundingClientRect().width));
        audioRef.current.currentTime = ratio * duration;
        setCurrentTime(ratio * duration);
    }, [duration]);

    // ====== "更多"区域：加载跨游戏数据 ======
    useEffect(() => {
        if (!showMore || crossGameData || crossGameLoading) return;
        setCrossGameLoading(true);
        checkSongInGames(match.arcadeSong.title, match.arcadeSong.artist)
            .then(res => { if (res) setCrossGameData(res.matches); })
            .catch(() => {})
            .finally(() => setCrossGameLoading(false));
    }, [showMore, crossGameData, crossGameLoading, match]);

    if (!match) return null;

    // ====== 数据 ======
    const charts = match.arcadeSong.charts || [];
    const levels = match.arcadeSong.levels || [];
    const ds = match.arcadeSong.ds || [];
    const rawBpm = match.arcadeSong.bpm;
    let bpmValue = 120;
    if (typeof rawBpm === 'number') bpmValue = rawBpm;
    else if (typeof rawBpm === 'string') { const p = parseInt(rawBpm); if (!isNaN(p)) bpmValue = p; }
    else if (typeof rawBpm === 'object' && rawBpm !== null) { const o = rawBpm as { min?: number; max?: number }; if (o.max) bpmValue = o.max; }

    const difficultyList = charts.length > 0 ? charts : levels.map((lv: string | number, i: number) => ({
        difficulty: Object.keys(DIFFICULTY_COLORS)[i] || `Level ${i + 1}`, level: lv, ds: ds[i] || 0
    }));

    const gameId = match.arcadeSong.gameId || 'maimai';
    const gameConfig = GAMES.find(g => g.id === gameId) || GAMES[0];
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
                <button onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="absolute top-4 right-4 z-30 w-8 h-8 bg-black/10 hover:bg-black/20 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors backdrop-blur-md">
                    <X size={20} strokeWidth={3} />
                </button>

                {/* 左侧封面 */}
                <div className="relative w-full md:w-72 h-72 md:h-auto flex-shrink-0 bg-slate-100 group">
                    <img src={match.arcadeSong.coverUrl || match.userSong.coverUrl}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={(e) => { const t = e.currentTarget; if (t.src !== match.userSong.coverUrl) t.src = match.userSong.coverUrl; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 right-12">
                        <img src={gameConfig.logoUrl} alt={gameConfig.name} className="h-10 w-auto object-contain drop-shadow-lg" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-1">{t('detail.category')}</div>
                        <div className="text-white text-lg font-black leading-tight drop-shadow-md">{match.arcadeSong.category || t('common.unknown')}</div>
                    </div>
                </div>

                {/* 右侧信息 */}
                <div className="flex-1 p-6 md:p-8 flex flex-col min-w-0 bg-white relative overflow-y-auto max-h-[80vh] md:max-h-none">

                    {/* 原始歌曲（可点击播放） */}
                    <div className={`mb-4 p-3 rounded-xl border transition-all cursor-pointer group/user
                        ${isPlaying && activeSource === 'user'
                            ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 ring-1 ring-cyan-300/50'
                            : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-100 hover:border-red-200'}`}
                        onClick={playUserSong}>
                        <div className="flex items-center gap-2 mb-2">
                            <Music size={14} className="text-red-400" />
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">{t('detail.originalSong')}</span>
                            {userAudioUrl && (
                                <span className="ml-auto text-[10px] font-bold text-slate-400 group-hover/user:text-cyan-500 transition-colors">
                                    {isPlaying && activeSource === 'user' ? '播放中' : '点击试听'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                                <img src={match.userSong.coverUrl} className="w-12 h-12 rounded-lg object-cover border-2 border-white shadow-sm" />
                                {userAudioUrl && (
                                    <div className={`absolute inset-0 rounded-lg flex items-center justify-center transition-opacity
                                        ${isPlaying && activeSource === 'user' ? 'opacity-100 bg-cyan-500/80' : 'opacity-0 group-hover/user:opacity-100 bg-black/40'}`}>
                                        {isPlaying && activeSource === 'user' ? <Pause size={16} className="text-white" fill="white" /> : <Play size={16} className="text-white" fill="white" />}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-700 text-sm truncate">{match.userSong.name}</p>
                                <p className="text-xs text-slate-500 truncate">{match.userSong.artists}</p>
                            </div>
                            {userLoading && <Loader2 size={14} className="animate-spin text-slate-300 flex-shrink-0" />}
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

                    {/* 街机歌曲标题 */}
                    <div className="mb-4 pr-8">
                        <span className="text-[10px] font-black text-cyan-500 uppercase tracking-wider">{t('detail.arcadeSong')}</span>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight mb-2 line-clamp-2 mt-1">{match.arcadeSong.title}</h2>
                        <p className="text-sm font-bold text-slate-500 line-clamp-1">{match.arcadeSong.artist}</p>
                    </div>

                    {/* BPM + 版本 */}
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                        <BpmVisualizer bpm={bpmValue} />
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">{t('detail.version')}</div>
                            <div className="text-xs font-black text-slate-700 truncate max-w-[120px]">{match.arcadeSong.version || '-'}</div>
                        </div>
                    </div>

                    {/* 难度 */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('detail.difficulty')}</h3>
                            {match.arcadeSong.type && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded text-white ${match.arcadeSong.type === 'DX' ? 'bg-orange-400' : 'bg-blue-400'}`}>{match.arcadeSong.type}</span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {difficultyList.length > 0 ? difficultyList.map((chart: { difficulty: string; level: string | number; ds?: number; notes?: number }, i: number) => (
                                <div key={i}
                                    className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-xl shadow-sm border-2 border-white ring-1 ring-slate-100 ${getDifficultyBg(chart.difficulty)} text-white overflow-hidden group hover:scale-105 transition-transform cursor-pointer select-none`}
                                    onClick={() => setShowDsIndex(showDsIndex === i ? null : i)}>
                                    <div className="absolute top-0 inset-x-0 h-1/2 bg-white/10" />
                                    <div className="text-[8px] font-bold uppercase opacity-90 relative z-10 -translate-y-px">{chart.difficulty.substring(0, 3)}</div>
                                    <div className="text-lg font-black leading-none relative z-10 drop-shadow-sm">{chart.level}</div>
                                    {chart.ds && chart.ds > 0 && showDsIndex === i && (
                                        <div className="absolute bottom-0.5 text-[7px] font-bold bg-black/50 px-1 rounded-full">{typeof chart.ds === 'number' ? chart.ds.toFixed(1) : chart.ds}</div>
                                    )}
                                </div>
                            )) : <div className="text-xs text-slate-400 italic py-2">{t('detail.noDifficultyData', '暂无难度数据')}</div>}
                        </div>
                    </div>

                    {/* ====== "更多"展开区域 ====== */}
                    <div className="mb-4">
                        <button onClick={() => setShowMore(!showMore)}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-cyan-500 transition-colors">
                            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <Gamepad2 size={13} />
                            <span>更多信息 · 跨游戏收录</span>
                        </button>

                        <AnimatePresence>
                            {showMore && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                >
                                    <div className="pt-3 space-y-3">
                                        {/* 跨游戏收录 */}
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">跨游戏收录</div>
                                            {crossGameLoading ? (
                                                <div className="flex items-center gap-2 py-3">
                                                    <Loader2 size={14} className="animate-spin text-slate-300" />
                                                    <span className="text-xs text-slate-400">正在查询...</span>
                                                </div>
                                            ) : crossGameData ? (
                                                <div className="space-y-2">
                                                    {Object.entries(crossGameData).map(([gId, info]) => {
                                                        const gConf = GAMES.find(g => g.id === gId);
                                                        if (!info.found || !gConf) return null;
                                                        const isCurrentGame = gId === gameId;
                                                        return (
                                                            <div key={gId} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isCurrentGame ? 'bg-cyan-50 ring-1 ring-cyan-200' : 'bg-slate-50'}`}>
                                                                <img src={gConf.logoUrl} alt={gConf.name} className="h-6 w-auto object-contain flex-shrink-0" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-xs font-bold text-slate-700 truncate">
                                                                        {info.song?.title || match.arcadeSong.title}
                                                                        {isCurrentGame && <span className="ml-1.5 text-[9px] text-cyan-500 font-black">当前</span>}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 truncate">{info.song?.artist || ''}</div>
                                                                </div>
                                                                {info.song?.levels && (
                                                                    <div className="flex gap-0.5 flex-shrink-0">
                                                                        {(info.song.levels as (string | number)[]).slice(0, 5).map((lv, i) => (
                                                                            <div key={i} className={`h-4 min-w-[16px] px-0.5 rounded text-[8px] font-bold text-white flex items-center justify-center ${getDifficultyBg(Object.keys(DIFFICULTY_COLORS)[i] || '')}`}>
                                                                                {lv}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {Object.values(crossGameData).filter(v => v.found).length === 0 && (
                                                        <p className="text-xs text-slate-400 py-2">未在其他游戏中找到</p>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ====== 播放器 ====== */}
                    <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
                        {arcadeSourceInfo && activeSource === 'arcade' && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <Headphones size={11} />
                                <span className="truncate">原曲来源: {arcadeSourceInfo}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button onClick={playArcadeFromStart} disabled={isLoading || !hasAnyAudio} title="从头试听原曲"
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all font-bold text-xs flex-shrink-0
                                    ${hasAnyAudio && !isLoading ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-[0.97]' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}>
                                <SkipBack size={14} />
                                <span className="hidden sm:inline">试听</span>
                            </button>

                            <button onClick={playPreview} disabled={isLoading || !hasAnyAudio}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-sm
                                    ${isLoading ? 'bg-slate-100 text-slate-400 cursor-wait'
                                        : !hasAnyAudio ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                        : isPlaying ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-200/40 active:scale-[0.98]'
                                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-200 active:scale-[0.98]'}`}>
                                {isLoading ? (<><Loader2 size={15} className="animate-spin" /><span>正在加载...</span></>)
                                    : !hasAnyAudio ? (<span>暂无音源</span>)
                                    : isPlaying ? (<><Pause size={15} fill="currentColor" /><span>播放中</span></>)
                                    : (<><Play size={15} fill="currentColor" /><span>预览</span></>)}
                            </button>

                            {hasAnyAudio && !isLoading && (
                                <div className="relative flex-shrink-0">
                                    <button onClick={() => setShowVolume(!showVolume)}
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${showVolume ? 'bg-cyan-50 text-cyan-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}>
                                        {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                    </button>
                                    <AnimatePresence>
                                        {showVolume && (
                                            <motion.div initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.95 }} transition={{ duration: 0.15 }}
                                                className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-100 p-3 w-40 z-50">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleVolumeChange(volume > 0 ? 0 : 0.5)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                                                        {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                                    </button>
                                                    <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                                        className="flex-1 h-1.5 cursor-pointer rounded-full appearance-none bg-slate-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:cursor-pointer" />
                                                    <span className="text-[10px] font-bold text-slate-400 w-7 text-right tabular-nums">{Math.round(volume * 100)}%</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {hasAnyAudio && !isLoading && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-medium text-slate-400 tabular-nums w-8 text-right flex-shrink-0">{formatTime(currentTime)}</span>
                                <div ref={progressRef} className="flex-1 h-5 flex items-center cursor-pointer group" onClick={handleProgressSeek} onMouseMove={handleProgressDrag}>
                                    <div className="w-full h-1 bg-slate-100 rounded-full relative overflow-visible">
                                        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-[width] duration-100" style={{ width: `${progress}%` }} />
                                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-cyan-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${progress}%` }} />
                                    </div>
                                </div>
                                <span className="text-[10px] font-medium text-slate-400 tabular-nums w-8 flex-shrink-0">{formatTime(duration)}</span>
                            </div>
                        )}
                    </div>

                    <audio ref={audioRef} preload="auto" />
                </div>
            </motion.div>
        </motion.div>
    );
}
