import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Clock, AlertCircle, ArrowRight, Music, ChevronDown, ChevronUp, Disc3, CheckCircle2, Search, Sparkles } from 'lucide-react';
import { GAMES } from '../config/games';
import Background from './Background';
import QRCode from 'qrcode';

interface MatchedSong {
    arcadeSong: {
        title: string;
        artist: string;
        coverUrl: string;
    };
    score: number;
    matchType: string;
}

interface ShareData {
    id: string;
    playlist: {
        name: string;
        trackCount: number;
        coverUrl: string;
    };
    results: Record<string, { 
        matches: MatchedSong[];
        totalMatches?: number;  // 真实总匹配数（不受截断限制）
    }>;
    aiComment: string;
    aiTitle?: string;
    aiSongs?: string[];
    shareUrl?: string;  // 完整的分享 URL（用于二维码）
    coveragePercent: number;
    createdAt: number;
    expiresAt: number;
}

interface SharePageProps {
    shareId: string;
    onBack: () => void;
}

export default function SharePage({ shareId, onBack }: SharePageProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [expired, setExpired] = useState(false);
    const [data, setData] = useState<ShareData | null>(null);
    const [error, setError] = useState('');
    const [expandedGame, setExpandedGame] = useState<string | null>(null);
    const [showAllSongs, setShowAllSongs] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

    const isRenderMode = window.location.href.includes('render=true');

    // 渲染模式下，使用存储的 shareUrl 生成二维码（而非 localhost）
    useEffect(() => {
        if (isRenderMode && data?.shareUrl) {
            QRCode.toDataURL(data.shareUrl, {
                width: 80,
                margin: 1,
                color: {
                    dark: '#334155',
                    light: '#ffffff'
                }
            }).then(url => setQrCodeUrl(url));
        }
    }, [isRenderMode, data?.shareUrl]);

    useEffect(() => {
        const fetchShareData = async () => {
            try {
                const API_BASE = `http://${window.location.hostname}:3002/api`;
                const response = await fetch(`${API_BASE}/share/${shareId}`);
                const result = await response.json();

                if (!result.success) {
                    if (result.error === 'expired') {
                        setExpired(true);
                        setTimeout(() => {
                            onBack();
                        }, 3000);
                    } else {
                        setError(result.message || '加载失败');
                    }
                } else {
                    setData(result.data);
                }
            } catch (e) {
                setError('网络错误');
            } finally {
                setLoading(false);
            }
        };

        fetchShareData();
    }, [shareId, onBack]);

    // 渲染模式 - 专用于服务端截图
    if (isRenderMode) {
        // 加载中或数据未准备好时显示占位符（但包含 data-share-card 以便 Puppeteer 可以找到）
        if (loading || !data) {
            return (
                <div className="flex justify-center bg-transparent p-0">
                    <div 
                        data-share-card 
                        className="w-[480px] h-[600px] bg-slate-100 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #fdf4ff 100%)' }}
                    >
                        <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-500 rounded-full animate-spin" />
                    </div>
                </div>
            );
        }

        // 计算渲染模式需要的数据
        const renderGameStats = GAMES.map(game => {
            const gameData = data.results[game.id];
            return {
                ...game,
                // 优先使用存储的真实总数，否则用 matches.length
                count: gameData?.totalMatches || gameData?.matches?.length || 0,
                matches: gameData?.matches || []
            };
        }).filter(g => g.count > 0).sort((a, b) => b.count - a.count);

        const renderTotalMatches = renderGameStats.reduce((sum, g) => sum + g.count, 0);

        // 收集所有匹配歌曲（去重）
        const renderAllSongs: { title: string; artist: string; games: string[]; matchType: string; score: number }[] = [];
        const renderSeenTitles = new Set<string>();
        
        renderGameStats.forEach(game => {
            game.matches.forEach(match => {
                const title = match.arcadeSong?.title;
                if (title && !renderSeenTitles.has(title)) {
                    renderSeenTitles.add(title);
                    renderAllSongs.push({
                        title,
                        artist: match.arcadeSong?.artist || '',
                        games: [game.shortName],
                        matchType: match.matchType,
                        score: match.score
                    });
                } else if (title) {
                    const existing = renderAllSongs.find(s => s.title === title);
                    if (existing && !existing.games.includes(game.shortName)) {
                        existing.games.push(game.shortName);
                    }
                }
            });
        });

        renderAllSongs.sort((a, b) => b.score - a.score);

        const renderLevel = (() => {
            const percent = data.coveragePercent;
            if (percent >= 80) return { name: t('share.levelLegend'), emoji: '🔥', color: '#ef4444', bgColor: '#fee2e2' };
            if (percent >= 60) return { name: t('share.levelMaster'), emoji: '⭐', color: '#ca8a04', bgColor: '#fef9c3' };
            if (percent >= 40) return { name: t('share.levelExpert'), emoji: '🎵', color: '#0891b2', bgColor: '#cffafe' };
            if (percent >= 20) return { name: t('share.levelAdvanced'), emoji: '🎮', color: '#16a34a', bgColor: '#dcfce7' };
            return { name: t('share.levelBeginner'), emoji: '🌱', color: '#64748b', bgColor: '#f1f5f9' };
        })();

        return (
            <div className="flex justify-center bg-transparent p-0">
                <div 
                    data-share-card 
                    className="w-full max-w-[480px] bg-slate-50 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #fdf4ff 100%)',
                        padding: '24px',
                    }}
                >
                    {/* 动态流体背景 - 使用绝对定位的色块模拟 CSS blur */}
                    <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '70%', height: '50%', background: 'rgba(165, 243, 252, 0.4)', borderRadius: '50%', filter: 'blur(60px)' }} />
                    <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '70%', height: '50%', background: 'rgba(251, 207, 232, 0.4)', borderRadius: '50%', filter: 'blur(60px)' }} />
                    <div style={{ position: 'absolute', top: '30%', left: '40%', width: '60%', height: '60%', background: 'rgba(191, 219, 254, 0.4)', borderRadius: '50%', filter: 'blur(60px)' }} />
                    
                    {/* 网格背景 */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0.4,
                        backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                        zIndex: 1
                    }} />

                    {/* 内容 */}
                    <div style={{ position: 'relative', zIndex: 10 }}>
                        {/* 标题区 */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                                {t('share.myPlaylist')}
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                「{data.playlist.name}」
                            </div>
                            <div style={{ fontSize: '14px', color: '#64748b' }}>
                                {t('share.withRhythm')}
                            </div>
                        </div>

                        {/* 浓度展示 */}
                        <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.8)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {t('share.concentration')}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 900, color: renderLevel.color, background: renderLevel.bgColor, padding: '2px 8px', borderRadius: '12px' }}>
                                    {renderLevel.emoji} {renderLevel.name}
                                </span>
                            </div>
                            <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.05em', marginBottom: '8px', color: '#0f172a' }}>
                                {data.coveragePercent}
                                <span style={{ fontSize: '24px', color: '#94a3b8' }}>%</span>
                            </div>
                            {/* 进度条 */}
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ 
                                    height: '100%', 
                                    width: `${data.coveragePercent}%`,
                                    background: 'linear-gradient(90deg, #22d3ee, #ec4899)',
                                    borderRadius: '4px'
                                }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#64748b' }}>
                                <span>{renderTotalMatches} {t('share.matched')}</span>
                                <span>{t('common.total')} {data.playlist.trackCount} {t('result.songs')}</span>
                            </div>
                        </div>

                        {/* AI 锐评 */}
                        {data.aiComment && (
                            <div style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(240, 249, 255, 0.8))', borderRadius: '12px', padding: '12px', marginBottom: '16px', position: 'relative', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Sparkles size={12} style={{ color: '#0ea5e9' }} />
                                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            AI {t('share.comment')}
                                        </span>
                                    </div>
                                    {/* AI 称号 */}
                                    {data.aiTitle && (
                                        <div style={{ 
                                            background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                                            color: 'white',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                                        }}>
                                            {data.aiTitle}
                                        </div>
                                    )}
                                </div>
                                <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6, fontWeight: 500 }}>
                                    {data.aiComment}
                                </p>
                            </div>
                        )}

                        {/* 热门歌曲/AI甄选曲目 (简略版，只显示前5首) */}
                        {(() => {
                            // 如果有 AI 甄选曲目，优先显示
                            const aiSongsArr = data.aiSongs || [];
                            const hasAiSongs = aiSongsArr.length > 0;
                            const displaySongs = hasAiSongs 
                                ? aiSongsArr.slice(0, 5).map((title: string) => {
                                    const found = renderAllSongs.find(s => s.title === title);
                                    return found || { title, artist: '', games: [] };
                                })
                                : renderAllSongs.slice(0, 5);

                            if (displaySongs.length === 0) return null;

                            return (
                                <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.4)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.4)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Sparkles size={10} />
                                        {hasAiSongs ? 'AI 甄选曲目' : t('share.topMatches')}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {displaySongs.map((song: { title: string; artist: string; games?: string[] }, idx: number) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                                                <div style={{ 
                                                    width: '16px', height: '16px', borderRadius: '4px', 
                                                    background: idx < 3 ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : '#e2e8f0', 
                                                    color: idx < 3 ? 'white' : '#64748b',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '9px', fontWeight: 'bold', flexShrink: 0
                                                }}>
                                                    {idx + 1}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                    <div style={{ fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                                                    <div style={{ fontSize: '9px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
                                                </div>
                                                {song.games && song.games.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '2px' }}>
                                                        {song.games.slice(0, 2).map(g => (
                                                            <span key={g} style={{ fontSize: '8px', background: '#e2e8f0', color: '#475569', padding: '1px 3px', borderRadius: '2px' }}>{g}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 游戏匹配数据 (简略版) */}
                        {renderGameStats.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    {t('share.gameBreakdown')}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {renderGameStats.slice(0, 6).map(game => (
                                        <div
                                            key={game.id}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '6px 8px', border: '1px solid rgba(255,255,255,0.5)', flex: '1 1 45%' }}
                                        >
                                            <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <img 
                                                    src={game.logoUrl} 
                                                    alt={game.name}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {game.name.replace(/\s*\(.*?\)/, '')}
                                                </div>
                                                <div style={{ fontSize: '9px', color: '#64748b' }}>
                                                    {game.shortName}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>
                                                {game.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 底部：品牌 + 时间 + 二维码 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                    <div style={{ width: '8px', height: '16px', background: '#22d3ee', transform: 'skewX(12deg)' }} />
                                    <div style={{ width: '8px', height: '16px', background: '#ec4899', transform: 'skewX(12deg)' }} />
                                    <span style={{ marginLeft: '4px', fontSize: '11px', fontWeight: 900, letterSpacing: '-0.02em', color: '#1e293b' }}>
                                        RHYTHM<span style={{ color: '#06b6d4' }}>SYNC</span>
                                    </span>
                                </div>
                                <div style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{t('share.scanToTry')}</span>
                                    <span style={{ opacity: 0.6 }}>•</span>
                                    <span>{new Date(data.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                </div>
                            </div>
                            {qrCodeUrl ? (
                                <div style={{ background: 'white', borderRadius: '8px', padding: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                    <img src={qrCodeUrl} alt="QR Code" style={{ width: '56px', height: '56px', display: 'block' }} />
                                </div>
                            ) : (
                                <div style={{ width: '64px', height: '64px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div className="w-4 h-4 bg-slate-300 rounded-full animate-pulse" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 加载中
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
                <Background />
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="w-12 h-12 border-[6px] border-white/30 border-t-cyan-500 rounded-full relative z-10"
                />
            </div>
        );
    }

    // 已过期
    if (expired) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
                <Background />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="prism-card p-8 text-center max-w-sm relative z-10"
                >
                    <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                        <Clock size={32} className="text-amber-500" />
                    </div>
                    <h1 className="text-xl font-black text-slate-800 mb-2">{t('share.expired')}</h1>
                    <p className="text-slate-500 mb-6">{t('share.expiredDesc')}</p>
                    <div className="flex items-center justify-center gap-2 text-cyan-600">
                        <span className="text-sm">{t('share.redirecting')}</span>
                        <motion.div
                            animate={{ x: [0, 5, 0] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                        >
                            <ArrowRight size={16} />
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // 错误
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
                <Background />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="prism-card p-8 text-center max-w-sm relative z-10"
                >
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h1 className="text-xl font-black text-slate-800 mb-2">{t('common.error')}</h1>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-cyan-500 text-white font-bold rounded-xl hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30"
                    >
                        {t('share.goHome')}
                    </button>
                </motion.div>
            </div>
        );
    }

    if (!data) return null;

    // 计算统计数据
    const gameStats = GAMES.map(game => {
        const gameData = data.results[game.id];
        return {
            ...game,
            // 使用真实总数，不受截断限制
            count: gameData?.totalMatches || gameData?.matches?.length || 0,
            matches: gameData?.matches || []
        };
    }).filter(g => g.count > 0).sort((a, b) => b.count - a.count);

    // 使用真实总匹配数
    const totalMatches = gameStats.reduce((sum, g) => {
        const gameData = data.results[g.id];
        return sum + (gameData?.totalMatches || gameData?.matches?.length || 0);
    }, 0);

    // 统计精确和模糊匹配
    let exactCount = 0;
    let fuzzyCount = 0;
    gameStats.forEach(g => {
        g.matches.forEach(m => {
            if (m.matchType === 'exact') exactCount++;
            else fuzzyCount++;
        });
    });

    // 收集所有匹配歌曲（去重）
    const allSongs: { title: string; artist: string; games: string[]; matchType: string; score: number }[] = [];
    const seenTitles = new Set<string>();
    
    gameStats.forEach(game => {
        game.matches.forEach(match => {
            const title = match.arcadeSong?.title;
            if (title && !seenTitles.has(title)) {
                seenTitles.add(title);
                allSongs.push({
                    title,
                    artist: match.arcadeSong?.artist || '',
                    games: [game.shortName],
                    matchType: match.matchType,
                    score: match.score
                });
            } else if (title) {
                // 已存在，添加游戏
                const existing = allSongs.find(s => s.title === title);
                if (existing && !existing.games.includes(game.shortName)) {
                    existing.games.push(game.shortName);
                }
            }
        });
    });

    // 按分数排序
    allSongs.sort((a, b) => b.score - a.score);

    // 浓度等级
    const getLevel = (percent: number) => {
        if (percent >= 80) return { name: t('share.levelLegend'), emoji: '🔥', color: 'text-red-500', bgColor: 'bg-red-100', borderColor: 'border-red-200' };
        if (percent >= 60) return { name: t('share.levelMaster'), emoji: '⭐', color: 'text-yellow-600', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200' };
        if (percent >= 40) return { name: t('share.levelExpert'), emoji: '🎵', color: 'text-cyan-600', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-200' };
        if (percent >= 20) return { name: t('share.levelAdvanced'), emoji: '🎮', color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200' };
        return { name: t('share.levelBeginner'), emoji: '🌱', color: 'text-slate-500', bgColor: 'bg-slate-100', borderColor: 'border-slate-200' };
    };

    const level = getLevel(data.coveragePercent);

    // 剩余时间
    const remainingHours = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / (1000 * 60 * 60)));

    // 创建时间格式化
    const createdDate = new Date(data.createdAt);
    const formattedDate = `${createdDate.getMonth() + 1}月${createdDate.getDate()}日 ${createdDate.getHours().toString().padStart(2, '0')}:${createdDate.getMinutes().toString().padStart(2, '0')}`;

    // 显示的歌曲数量
    const displaySongs = showAllSongs ? allSongs : allSongs.slice(0, 8);

    return (
        <div className="min-h-screen p-4 py-8 pb-32 relative font-sans">
            {/* 动态背景 - 清新流体风格 */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-[#f0f9ff]">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-cyan-200/30 blur-[100px] animate-blob" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-pink-200/30 blur-[100px] animate-blob animation-delay-2000" />
                <div className="absolute top-[30%] left-[40%] w-[60vw] h-[60vw] rounded-full bg-blue-200/30 blur-[100px] animate-blob animation-delay-4000" />
                {/* 噪点纹理 */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
            </div>
            
            <div className="relative z-10 max-w-lg mx-auto space-y-4">
                {/* 品牌标识 */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-3 h-6 bg-cyan-400 skew-x-12 shadow-lg shadow-cyan-200" />
                    <div className="w-3 h-6 bg-pink-500 skew-x-12 shadow-lg shadow-pink-200" />
                    <span className="ml-2 text-2xl font-black text-slate-800 tracking-tight">
                        RHYTHM<span className="text-cyan-500">SYNC</span>
                    </span>
                </div>

                {/* 主卡片 - 浓度信息 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="prism-card overflow-hidden"
                >
                    {/* 歌单信息 */}
                    <div className="p-6 border-b border-white/40">
                        <div className="flex items-start gap-4">
                            {data.playlist.coverUrl && (
                                <img 
                                    src={data.playlist.coverUrl} 
                                    alt="" 
                                    className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 shadow-md"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-cyan-600 uppercase tracking-widest mb-1">
                                    {t('share.myPlaylist')}
                                </div>
                                <h1 className="text-xl font-black text-slate-800 truncate">
                                    「{data.playlist.name}」
                                </h1>
                                <p className="text-slate-500 text-sm mt-1">
                                    {t('share.withRhythm')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 浓度显示 */}
                    <div className="p-6 bg-gradient-to-br from-white/40 to-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {t('share.concentration')}
                            </span>
                            <span className={`text-sm font-black px-3 py-1 rounded-full border ${level.bgColor} ${level.color} ${level.borderColor}`}>
                                {level.emoji} {level.name}
                            </span>
                        </div>
                        <div className="text-7xl font-black text-slate-800 tracking-tighter mb-4 flex items-baseline">
                            {data.coveragePercent}
                            <span className="text-3xl text-slate-400 ml-1">%</span>
                        </div>
                        {/* 进度条 */}
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-6 ring-1 ring-slate-200">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${data.coveragePercent}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full shadow-[0_2px_10px_rgba(236,72,153,0.4)]"
                            />
                        </div>
                        
                        {/* 统计数据 */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-white/50 rounded-2xl border border-white/60 shadow-sm">
                                <div className="text-2xl font-black text-slate-700">{totalMatches}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">{t('share.totalMatched')}</div>
                            </div>
                            <div className="text-center p-3 bg-pink-50 rounded-2xl border border-pink-100 shadow-sm">
                                <div className="text-2xl font-black text-pink-500">{exactCount}</div>
                                <div className="text-[10px] text-pink-300 uppercase font-bold">{t('result.exact')}</div>
                            </div>
                            <div className="text-center p-3 bg-yellow-50 rounded-2xl border border-yellow-100 shadow-sm">
                                <div className="text-2xl font-black text-yellow-500">{fuzzyCount}</div>
                                <div className="text-[10px] text-yellow-300 uppercase font-bold">{t('result.fuzzy')}</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* AI 锐评卡片 */}
                {data.aiComment && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 border border-white/80 shadow-sm"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">✨</span>
                            <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                                AI {t('share.comment')}
                            </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed text-lg font-medium">
                            {data.aiComment}
                        </p>
                    </motion.div>
                )}

                {/* 游戏匹配详情 */}
                {gameStats.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="prism-card overflow-hidden"
                    >
                        <div className="p-5 border-b border-white/40 bg-white/20">
                            <div className="flex items-center gap-2">
                                <Disc3 size={18} className="text-cyan-500" />
                                <span className="text-sm font-bold text-slate-700">
                                    {t('share.gameBreakdown')}
                                </span>
                            </div>
                        </div>
                        
                        <div className="divide-y divide-slate-100">
                            {gameStats.map((game) => (
                                <div key={game.id}>
                                    <button
                                        onClick={() => setExpandedGame(expandedGame === game.id ? null : game.id)}
                                        className="w-full flex items-center gap-3 p-4 hover:bg-white/40 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white/50 border border-white/60 flex items-center justify-center shadow-sm overflow-hidden p-1.5">
                                            <img 
                                                src={game.logoUrl} 
                                                alt={game.name}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-slate-800 font-bold">{game.name}</div>
                                            <div className="text-slate-500 text-xs font-medium">{game.count} {t('share.songsMatched')}</div>
                                        </div>
                                        {expandedGame === game.id ? (
                                            <ChevronUp size={18} className="text-slate-400" />
                                        ) : (
                                            <ChevronDown size={18} className="text-slate-400" />
                                        )}
                                    </button>
                                    
                                    <AnimatePresence>
                                        {expandedGame === game.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden bg-slate-50/50"
                                            >
                                                <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
                                                    {game.matches.slice(0, 15).map((match, i) => (
                                                        <div key={i} className="flex items-center gap-3 py-2">
                                                            <div className={`w-6 h-6 rounded flex items-center justify-center ${match.matchType === 'exact' ? 'bg-pink-100 text-pink-500' : 'bg-yellow-100 text-yellow-500'}`}>
                                                                {match.matchType === 'exact' ? <CheckCircle2 size={14} /> : <Search size={14} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-slate-800 text-sm truncate font-medium">{match.arcadeSong?.title}</div>
                                                                <div className="text-slate-500 text-xs truncate">{match.arcadeSong?.artist}</div>
                                                            </div>
                                                            <div className="text-slate-400 text-xs font-bold">{match.score}%</div>
                                                        </div>
                                                    ))}
                                                    {game.matches.length > 15 && (
                                                        <div className="text-center text-slate-400 text-xs py-2 font-bold">
                                                            +{game.matches.length - 15} {t('share.moreSongs')}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* 热门匹配歌曲 */}
                {allSongs.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="prism-card overflow-hidden"
                    >
                        <div className="p-5 border-b border-white/40 bg-white/20">
                            <div className="flex items-center gap-2">
                                <Music size={18} className="text-pink-500" />
                                <span className="text-sm font-bold text-slate-700">
                                    {t('share.topMatches')}
                                </span>
                                <span className="text-slate-400 text-xs ml-auto font-bold">
                                    {allSongs.length} {t('share.uniqueSongs')}
                                </span>
                            </div>
                        </div>
                        
                        <div className="divide-y divide-slate-100">
                            {displaySongs.map((song, idx) => (
                                <motion.div
                                    key={song.title}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="flex items-center gap-3 p-4 hover:bg-white/40 transition-colors"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shadow-sm ${idx < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-orange-200' : 'bg-slate-100 text-slate-500'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-slate-800 font-bold truncate">{song.title}</div>
                                        <div className="text-slate-500 text-xs truncate font-medium">{song.artist}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                        {song.games.slice(0, 2).map(g => (
                                            <span key={g} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                                                {g}
                                            </span>
                                        ))}
                                        {song.games.length > 2 && (
                                            <span className="text-[10px] text-slate-400 font-bold">+{song.games.length - 2}</span>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                        
                        {allSongs.length > 8 && (
                            <button
                                onClick={() => setShowAllSongs(!showAllSongs)}
                                className="w-full p-4 text-center text-cyan-600 text-sm font-bold hover:bg-white/40 transition-colors border-t border-slate-100"
                            >
                                {showAllSongs ? t('share.showLess') : t('share.showAll', { count: allSongs.length })}
                            </button>
                        )}
                    </motion.div>
                )}

                {/* 底部信息 */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-between text-slate-400 text-xs px-2 font-bold"
                >
                    <div className="flex items-center gap-4">
                        <span>{t('share.createdAt')}: {formattedDate}</span>
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {t('share.expiresIn', { hours: remainingHours })}
                        </span>
                    </div>
                </motion.div>

                {/* 底部 CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, type: 'spring' }}
                    className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent z-50"
                >
                    <div className="max-w-lg mx-auto">
                        <motion.button
                            onClick={onBack}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-pink-500 text-white text-lg font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-pink-500/20 hover:shadow-pink-500/40 hover:-translate-y-1 transition-all"
                        >
                            <span>{t('share.tryItNow')}</span>
                            <motion.div
                                animate={{ x: [0, 5, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            >
                                <ArrowRight size={20} />
                            </motion.div>
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
