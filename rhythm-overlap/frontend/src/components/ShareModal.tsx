import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Download, Share2, Loader2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { GAMES } from '../config/games';
import type { UserPlaylist, GameMatchResult } from '../services/api';

const API_BASE = `http://${window.location.hostname}:3002/api`;

interface ShareModalProps {
    playlist: UserPlaylist;
    results: Record<string, GameMatchResult>;
    onClose: () => void;
}

// 浓度等级评语
const getConcentrationLevel = (percent: number, t: (key: string) => string) => {
    if (percent >= 80) return { level: t('share.levelLegend'), emoji: '🔥', color: '#ef4444', bgColor: '#fee2e2' };
    if (percent >= 60) return { level: t('share.levelMaster'), emoji: '⭐', color: '#ca8a04', bgColor: '#fef9c3' };
    if (percent >= 40) return { level: t('share.levelExpert'), emoji: '🎵', color: '#0891b2', bgColor: '#cffafe' };
    if (percent >= 20) return { level: t('share.levelAdvanced'), emoji: '🎮', color: '#16a34a', bgColor: '#dcfce7' };
    return { level: t('share.levelBeginner'), emoji: '🌱', color: '#64748b', bgColor: '#f1f5f9' };
};

// AI 锐评 API
async function getAIComment(playlist: UserPlaylist, results: Record<string, GameMatchResult>, coveragePercent: number): Promise<{ comment: string; title?: string; songs?: string[]; error?: string }> {
    const gameSummary = GAMES.map(game => {
        const count = results[game.id]?.matches?.length || 0;
        return `${game.shortName}: ${count}首`;
    }).join(', ');
    
    const allMatchedSongs: string[] = [];
    const seenTitles = new Set<string>();
    
    for (const game of GAMES) {
        const matches = results[game.id]?.matches || [];
        for (const match of matches) {
            const title = match.arcadeSong?.title;
            if (title && !seenTitles.has(title)) {
                seenTitles.add(title);
                allMatchedSongs.push(title);
            }
            if (allMatchedSongs.length >= 20) break;
        }
        if (allMatchedSongs.length >= 20) break;
    }
    
    try {
        const response = await fetch(`${API_BASE}/ai/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playlistName: playlist.name,
                trackCount: playlist.trackCount,
                coveragePercent,
                gameSummary,
                topGames: GAMES.slice(0, 3).map(g => ({
                    name: g.name,
                    count: results[g.id]?.matches?.length || 0
                })),
                matchedSongs: allMatchedSongs
            })
        });
        
        if (response.status === 429) {
            const data = await response.json();
            return { comment: '', error: data.error || '请求太频繁，请稍后再试' };
        }
        
        const data = await response.json();
        if (data.success) return { comment: data.comment, title: data.title, songs: data.songs };
        return { comment: '这份歌单真是宝藏啊！音游玩家狂喜 🎮' };
    } catch {
        return { comment: '这份歌单真是宝藏啊！音游玩家狂喜 🎮' };
    }
}

// 创建分享链接
async function createShareLink(
    playlist: UserPlaylist, 
    results: Record<string, GameMatchResult>, 
    aiComment: string, 
    coveragePercent: number,
    aiTitle?: string,
    aiSongs?: string[]
): Promise<string | null> {
    try {
        // 构建分享 URL 的基础部分（用于存储到服务端，让服务端生成正确的二维码）
        const shareUrlBase = `${window.location.origin}${window.location.pathname}#/share/`;
        
        const response = await fetch(`${API_BASE}/share/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playlist,
                results,
                aiComment,
                coveragePercent,
                aiTitle,
                aiSongs,
                shareUrlBase  // 传递 URL 基础部分
            })
        });
        
        const data = await response.json();
        if (data.success) {
            return `${shareUrlBase}${data.shareId}`;
        }
        return null;
    } catch {
        return null;
    }
}

export default function ShareModal({ playlist, results, onClose }: ShareModalProps) {
    const { t } = useTranslation();
    const cardRef = useRef<HTMLDivElement>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [shareUrl, setShareUrl] = useState<string>('');
    const [aiComment, setAiComment] = useState<string>('');
    const [aiTitle, setAiTitle] = useState<string>('');
    const [aiSongs, setAiSongs] = useState<string[]>([]);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAIComment, setShowAIComment] = useState(true);
    const [isPreview, setIsPreview] = useState(true);

    const totalMatches = Object.values(results).reduce((max, r) => 
        Math.max(max, r?.matches?.length || 0), 0);
    const coveragePercent = playlist.trackCount > 0 
        ? Math.round((totalMatches / playlist.trackCount) * 100)
        : 0;
    
    const concentration = getConcentrationLevel(coveragePercent, t);

    const fetchAIComment = useCallback(async () => {
        setIsLoadingAI(true);
        setAiError('');
        const result = await getAIComment(playlist, results, coveragePercent);
        if (result.error) {
            setAiError(result.error);
        } else {
            setAiComment(result.comment);
            if (result.title) setAiTitle(result.title);
            if (result.songs) setAiSongs(result.songs);
        }
        setIsLoadingAI(false);
    }, [playlist, results, coveragePercent]);

    const createShareAndQRCode = useCallback(async () => {
        const url = await createShareLink(playlist, results, aiComment, coveragePercent, aiTitle, aiSongs);
        if (url) {
            setShareUrl(url);
            const qr = await QRCode.toDataURL(url, {
                width: 80,
                margin: 1,
                color: {
                    dark: '#334155',
                    light: '#ffffff'
                }
            });
            setQrCodeUrl(qr);
        }
    }, [playlist, results, aiComment, coveragePercent, aiTitle, aiSongs]);

    useEffect(() => {
        if (showAIComment && !aiComment && !aiError) {
            fetchAIComment();
        }
    }, [showAIComment, aiComment, aiError, fetchAIComment]);

    useEffect(() => {
        if (aiComment && !shareUrl) {
            createShareAndQRCode();
        }
    }, [aiComment, shareUrl, createShareAndQRCode]);

    // 生成并下载图片（使用服务端生成）
    const handleDownload = async () => {
        // 先确保创建分享链接（获取 shareId）
        if (!shareUrl) {
            await createShareAndQRCode();
        }
        
        // 解析 shareId
        const match = shareUrl.match(/share\/([a-zA-Z0-9]+)/);
        const shareId = match ? match[1] : null;
        
        if (!shareId) {
            alert('无法获取分享 ID');
            return;
        }

        setIsGenerating(true);
        setIsPreview(false);
        
        try {
            // 请求服务端生成的图片
            const response = await fetch(`${API_BASE}/share/${shareId}/image`);
            if (!response.ok) throw new Error('生成失败');
            
            const blob = await response.blob();
            
            const safeName = playlist.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 20) || 'share';
            const fileName = `rhythm-sync-${safeName}-${Date.now()}.png`;
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
        } catch (e) {
            console.error('生成图片失败:', e);
            alert('生成图片失败，请重试');
        } finally {
            setIsGenerating(false);
            setIsPreview(true);
        }
    };

    // 分享功能
    const handleShare = async () => {
        if (!cardRef.current) return;
        
        setIsGenerating(true);
        setIsPreview(false);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        try {
            const element = cardRef.current;
            
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff', // 改为白色背景
                useCORS: true,
                allowTaint: false,
                logging: false,
                imageTimeout: 5000,
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.querySelector('[data-share-card]');
                    if (clonedElement) {
                        const htmlEl = clonedElement as HTMLElement;
                        // 强制设置宽度以确保生成的图片不是根据当前屏幕宽度
                        htmlEl.style.width = '480px';
                        htmlEl.style.maxWidth = '480px';
                        htmlEl.style.height = 'auto';
                        htmlEl.style.overflow = 'visible';
                        
                        const allElements = clonedElement.querySelectorAll('*');
                        allElements.forEach((el) => {
                            const childEl = el as HTMLElement;
                            childEl.style.backdropFilter = 'none';
                            childEl.style.webkitBackdropFilter = 'none';
                        });
                    }
                }
            });
            
            await new Promise<void>((resolve) => {
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        alert('生成图片失败');
                        resolve();
                        return;
                    }
                    
                    const file = new File([blob], `rhythm-sync-share-${Date.now()}.png`, { type: 'image/png' });
                    
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                title: t('share.shareTitle'),
                                text: `我的「${playlist.name}」与音游的浓度达到了 ${coveragePercent}%！`,
                                files: [file]
                            });
                        } catch (err) {
                            if ((err as Error).name !== 'AbortError') {
                                downloadBlob(blob);
                            }
                        }
                    } else {
                        downloadBlob(blob);
                    }
                    
                    function downloadBlob(b: Blob) {
                        const url = URL.createObjectURL(b);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `rhythm-sync-share-${Date.now()}.png`;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        setTimeout(() => {
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }, 100);
                    }
                    
                    resolve();
                }, 'image/png', 1.0);
            });
        } catch (e) {
            console.error('分享失败:', e);
            alert('生成图片失败，请重试');
        } finally {
            setIsGenerating(false);
            setIsPreview(true);
        }
    };

    const gameStats = GAMES.map(game => ({
        ...game,
        count: results[game.id]?.matches?.length || 0,
        matches: results[game.id]?.matches || []
    })).filter(g => g.count > 0).sort((a, b) => b.count - a.count);

    // 获取热门匹配歌曲 (前5首)
    const topSongs: { title: string; artist: string; games: string[] }[] = [];
    const seenTitles = new Set<string>();
    
    // 简单的歌曲提取逻辑：遍历高匹配数游戏，提取歌曲
    gameStats.forEach(game => {
        game.matches.forEach(match => {
            const title = match.arcadeSong?.title;
            if (title && !seenTitles.has(title)) {
                seenTitles.add(title);
                topSongs.push({
                    title,
                    artist: match.arcadeSong?.artist || '',
                    games: [game.shortName]
                });
            } else if (title) {
                const existing = topSongs.find(s => s.title === title);
                if (existing && !existing.games.includes(game.shortName)) {
                    existing.games.push(game.shortName);
                }
            }
        });
    });

    const displaySongsLocal = topSongs.slice(0, 5); // 本地计算的最匹配歌曲
    
    // 如果 AI 返回了代表歌曲，优先使用
    const displaySongs = aiSongs.length > 0 
        ? aiSongs.map(title => {
            // 尝试在 results 中找到对应的歌曲信息
            let artist = '';
            const games: string[] = [];
            
            for (const game of GAMES) {
                const match = results[game.id]?.matches?.find(m => m.arcadeSong?.title === title);
                if (match) {
                    if (!artist) artist = match.arcadeSong?.artist || '';
                    if (!games.includes(game.shortName)) {
                        games.push(game.shortName);
                    }
                }
            }
            
            return {
                title,
                artist: artist || '', // AI 推荐的歌曲可能没有 artist 信息
                games: games.length > 0 ? games : []
            };
        }) 
        : displaySongsLocal;

    const truncatedComment = aiComment.length > 20 ? aiComment.slice(0, 20) + '...' : aiComment;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto" // max-w-md 改为 max-w-xl
                    onClick={e => e.stopPropagation()}
                >
                    {/* 顶部工具栏 */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                        <h2 className="font-black text-slate-800 flex items-center gap-2">
                            <Share2 size={18} className="text-cyan-500" />
                            {t('share.title')}
                        </h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* 分享卡片预览 - 使用纯色背景，避免 blur 效果 */}
                    <div className="p-5 bg-slate-50 flex justify-center">
                        <div
                            ref={cardRef}
                            data-share-card
                            style={{
                                background: 'linear-gradient(135deg, #f0f9ff 0%, #fdf4ff 100%)', // 浅蓝到浅粉的清新渐变
                                borderRadius: '16px',
                                padding: '24px',
                                color: '#1e293b',
                                position: 'relative',
                                overflow: 'hidden',
                                width: '100%',
                                maxWidth: '480px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
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
                                        「{playlist.name}」
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
                                        <span style={{ fontSize: '12px', fontWeight: 900, color: concentration.color, background: concentration.bgColor, padding: '2px 8px', borderRadius: '12px' }}>
                                            {concentration.emoji} {concentration.level}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.05em', marginBottom: '8px', color: '#0f172a' }}>
                                        {coveragePercent}
                                        <span style={{ fontSize: '24px', color: '#94a3b8' }}>%</span>
                                    </div>
                                    {/* 进度条 */}
                                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            height: '100%', 
                                            width: `${coveragePercent}%`,
                                            background: 'linear-gradient(90deg, #22d3ee, #ec4899)',
                                            borderRadius: '4px'
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#64748b' }}>
                                        <span>{totalMatches} {t('share.matched')}</span>
                                        <span>{t('common.total')} {playlist.trackCount} {t('result.songs')}</span>
                                    </div>
                                </div>

                                {/* AI 锐评 (移到浓度展示后) */}
                                {showAIComment && (
                                    <div style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(240, 249, 255, 0.8))', borderRadius: '12px', padding: '12px', marginBottom: '16px', position: 'relative', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Sparkles size={12} style={{ color: '#0ea5e9' }} />
                                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    AI {t('share.comment')}
                                                </span>
                                            </div>
                                            {/* 称号展示 */}
                                            {!isLoadingAI && aiTitle && (
                                                <div style={{ 
                                                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                                                    color: 'white',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '10px',
                                                    fontWeight: 'bold',
                                                    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                                                }}>
                                                    {aiTitle}
                                                </div>
                                            )}
                                        </div>
                                        {isLoadingAI ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px' }}>
                                                <Loader2 size={14} className="animate-spin" />
                                                {t('share.generating')}...
                                            </div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6, fontWeight: 500, opacity: isPreview && aiComment.length > 20 ? 0.8 : 1 }}>
                                                    {isPreview ? aiComment : aiComment}
                                                </p>
                                                {isPreview && aiComment.length > 20 && (
                                                    <div style={{ 
                                                        position: 'absolute', 
                                                        left: 0,
                                                        right: 0, 
                                                        top: '40%', // 从中间开始遮挡
                                                        bottom: 0,
                                                        background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 60%, rgba(255,255,255,1) 100%)',
                                                        display: 'flex',
                                                        alignItems: 'flex-end',
                                                        justifyContent: 'center',
                                                        paddingBottom: '8px',
                                                        borderRadius: '0 0 12px 12px'
                                                    }}>
                                                        <span style={{ 
                                                            fontSize: '10px', 
                                                            color: 'white', 
                                                            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', 
                                                            padding: '4px 10px', 
                                                            borderRadius: '20px',
                                                            fontWeight: 'bold',
                                                            boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <Download size={10} />
                                                            {t('share.saveToSee')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 热门歌曲/代表歌曲展示 */}
                                {displaySongs.length > 0 && (
                                    <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.4)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.4)' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Sparkles size={10} />
                                            {aiSongs.length > 0 ? 'AI 甄选曲目' : t('share.topMatches')}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {displaySongs.map((song, idx) => (
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
                                                    <div style={{ display: 'flex', gap: '2px' }}>
                                                        {song.games.slice(0, 2).map(g => (
                                                            <span key={g} style={{ fontSize: '8px', background: '#e2e8f0', color: '#475569', padding: '1px 3px', borderRadius: '2px' }}>{g}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 游戏匹配数据 (调整样式) */}
                                {gameStats.length > 0 && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                            {t('share.gameBreakdown')}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {gameStats.slice(0, 6).map(game => (
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
                                                            {game.name.replace(/\s*\(.*?\)/, '')} {/* 移除括号内的内容以节省空间 */}
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

                                {/* 底部：品牌 + 二维码 */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                            <div style={{ width: '8px', height: '16px', background: '#22d3ee', transform: 'skewX(12deg)' }} />
                                            <div style={{ width: '8px', height: '16px', background: '#ec4899', transform: 'skewX(12deg)' }} />
                                            <span style={{ marginLeft: '4px', fontSize: '11px', fontWeight: 900, letterSpacing: '-0.02em', color: '#1e293b' }}>
                                                RHYTHM<span style={{ color: '#06b6d4' }}>SYNC</span>
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                                            {t('share.scanToTry')}
                                        </div>
                                    </div>
                                    {qrCodeUrl ? (
                                        <div style={{ background: 'white', borderRadius: '8px', padding: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                            <img src={qrCodeUrl} alt="QR Code" style={{ width: '56px', height: '56px', display: 'block' }} />
                                        </div>
                                    ) : (
                                        <div style={{ width: '64px', height: '64px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Loader2 size={16} className="animate-spin" style={{ color: '#94a3b8' }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 操作区 */}
                    <div className="p-5 space-y-3">
                        {/* 按钮 */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleDownload}
                                disabled={isGenerating || isLoadingAI}
                                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-black rounded-xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Download size={18} />
                                )}
                                {t('share.download')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
