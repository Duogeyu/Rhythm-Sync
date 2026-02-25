import { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Music, ArrowLeft, Search, X, ArrowUpDown, ChevronRight, SlidersHorizontal, Check, AlertCircle, Tag, Share2, Disc3 } from 'lucide-react';
import ShareModal from './ShareModal';

// 自定义 Hook: 支持鼠标拖动滚动
function useDragScroll() {
    const ref = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (!ref.current) return;
        isDragging.current = true;
        startX.current = e.pageX - ref.current.offsetLeft;
        scrollLeft.current = ref.current.scrollLeft;
        ref.current.style.cursor = 'grabbing';
        ref.current.style.userSelect = 'none';
    }, []);

    const onMouseLeave = useCallback(() => {
        if (!ref.current) return;
        isDragging.current = false;
        ref.current.style.cursor = 'grab';
        ref.current.style.userSelect = '';
    }, []);

    const onMouseUp = useCallback(() => {
        if (!ref.current) return;
        isDragging.current = false;
        ref.current.style.cursor = 'grab';
        ref.current.style.userSelect = '';
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current || !ref.current) return;
        e.preventDefault();
        const x = e.pageX - ref.current.offsetLeft;
        const walk = (x - startX.current) * 1.5;
        ref.current.scrollLeft = scrollLeft.current - walk;
    }, []);

    return { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove };
}

import { GAMES, containerStagger } from '../config/games';
import type { UserPlaylist, GameMatchResult, MatchItem, MatchTag } from '../services/api';
import GameTab from './GameTab';
import MatchCard from './MatchCard';

interface ResultStepProps {
    playlist: UserPlaylist;
    results: Record<string, GameMatchResult>;
    isMatching: boolean;
    onBack: () => void;
    onSelectSong: (match: MatchItem) => void;
}

type SortOption = 'score-desc' | 'score-asc' | 'title-asc' | 'title-desc' | 'artist-asc';
type FilterOption = 'all' | 'exact' | 'fuzzy';

const SORT_OPTION_KEYS: { value: SortOption; labelKey: string }[] = [
    { value: 'score-desc', labelKey: 'result.sort.scoreDesc' },
    { value: 'score-asc', labelKey: 'result.sort.scoreAsc' },
    { value: 'title-asc', labelKey: 'result.sort.titleAsc' },
    { value: 'title-desc', labelKey: 'result.sort.titleDesc' },
    { value: 'artist-asc', labelKey: 'result.sort.artistAsc' },
];

const FILTER_OPTION_KEYS: { value: FilterOption; labelKey: string; color: string }[] = [
    { value: 'all', labelKey: 'result.filter.all', color: 'bg-slate-500' },
    { value: 'exact', labelKey: 'result.filter.exact', color: 'bg-pink-500' },
    { value: 'fuzzy', labelKey: 'result.filter.fuzzy', color: 'bg-yellow-500' },
];

const TAG_FILTER_OPTIONS: { value: MatchTag | 'all'; labelKey: string; color: string; bgColor: string }[] = [
    { value: 'all', labelKey: 'tags.all', color: 'text-slate-600', bgColor: 'bg-slate-100' },
    { value: 'perfect_match', labelKey: 'tags.perfect_match', color: 'text-pink-600', bgColor: 'bg-pink-50' },
    { value: 'same_artist', labelKey: 'tags.same_artist', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { value: 'similar_artist', labelKey: 'tags.similar_artist', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { value: 'different_artist', labelKey: 'tags.different_artist', color: 'text-amber-600', bgColor: 'bg-amber-50' },
];

export default function ResultStep({ playlist, results, isMatching, onBack, onSelectSong }: ResultStepProps) {
    const { t } = useTranslation();
    const [activeGameId, setActiveGameId] = useState('maimai');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('score-desc');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');
    const [tagFilter, setTagFilter] = useState<MatchTag | 'all'>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    const tabScroll = useDragScroll();

    const rawMatches = results[activeGameId]?.matches ?? [];
    const activeGameConfig = GAMES.find(g => g.id === activeGameId) || GAMES[0];

    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = { all: rawMatches.length };
        rawMatches.forEach(m => {
            (m.tags || []).forEach(tag => {
                counts[tag] = (counts[tag] || 0) + 1;
            });
        });
        return counts;
    }, [rawMatches]);

    const filteredAndSortedMatches = useMemo(() => {
        let matches = [...rawMatches];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            matches = matches.filter(m => {
                const title = (m.arcadeSong?.title || '').toLowerCase();
                const artist = (m.arcadeSong?.artist || '').toLowerCase();
                const userTitle = (m.userSong?.name || '').toLowerCase();
                const userArtist = (m.userSong?.artists || '').toLowerCase();
                return title.includes(query) || artist.includes(query) ||
                    userTitle.includes(query) || userArtist.includes(query);
            });
        }

        if (filterBy !== 'all') {
            matches = matches.filter(m => m.matchType === filterBy);
        }

        if (tagFilter !== 'all') {
            matches = matches.filter(m => m.tags?.includes(tagFilter));
        }

        matches.sort((a, b) => {
            switch (sortBy) {
                case 'score-desc': return (b.score || 0) - (a.score || 0);
                case 'score-asc': return (a.score || 0) - (b.score || 0);
                case 'title-asc': return (a.arcadeSong?.title || '').localeCompare(b.arcadeSong?.title || '');
                case 'title-desc': return (b.arcadeSong?.title || '').localeCompare(a.arcadeSong?.title || '');
                case 'artist-asc': return (a.arcadeSong?.artist || '').localeCompare(b.arcadeSong?.artist || '');
                default: return 0;
            }
        });

        return matches;
    }, [rawMatches, searchQuery, filterBy, tagFilter, sortBy]);

    const coveragePercent = playlist.trackCount > 0
        ? Math.round((rawMatches.length / playlist.trackCount) * 100)
        : 0;

    const exactCount = rawMatches.filter(m => m.matchType === 'exact').length;
    const fuzzyCount = rawMatches.filter(m => m.matchType === 'fuzzy').length;

    const hasActiveFilters = searchQuery || filterBy !== 'all' || tagFilter !== 'all';

    return (
        <motion.div
            className="w-full h-full flex flex-col relative z-10"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
            {/* ===== 顶栏 ===== */}
            <div className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30">
                <div className="px-4 sm:px-6 lg:px-8">
                    {/* 导航 + 歌单信息 + 统计数据 */}
                    <div className="flex items-center justify-between py-4 gap-4">
                        {/* 左：返回 */}
                        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-cyan-500 transition-colors flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-slate-100 hover:bg-cyan-50 flex items-center justify-center transition-colors">
                                <ArrowLeft size={15} strokeWidth={2.5} />
                            </div>
                            <span className="text-xs font-bold hidden sm:inline">{t('result.reselect')}</span>
                        </button>

                        {/* 中：统计数据条 */}
                        <div className="flex items-center gap-3 sm:gap-5 flex-1 justify-center min-w-0">
                            {/* 覆盖率 */}
                            <div className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activeGameConfig.color} flex items-center justify-center shadow-sm`}>
                                    <span className="text-white text-sm font-black">{coveragePercent}%</span>
                                </div>
                                <div className="hidden sm:block">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('result.coverage')}</div>
                                    <div className="text-sm font-black text-slate-700">{rawMatches.length} <span className="text-slate-400 font-medium text-xs">/ {playlist.trackCount}</span></div>
                                </div>
                            </div>

                            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                            {/* 精确 / 模糊 */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-pink-400" />
                                    <span className="text-xs font-bold text-slate-600">{exactCount}</span>
                                    <span className="text-[10px] text-slate-400 hidden sm:inline">{t('result.exact')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span className="text-xs font-bold text-slate-600">{fuzzyCount}</span>
                                    <span className="text-[10px] text-slate-400 hidden sm:inline">{t('result.fuzzy')}</span>
                                </div>
                            </div>
                        </div>

                        {/* 右：歌单名 */}
                        <div className="text-right flex-shrink-0">
                            <h1 className="text-sm font-black text-slate-700 truncate max-w-[140px] sm:max-w-[200px]">{playlist.name}</h1>
                            <p className="text-[10px] font-medium text-slate-400">{playlist.trackCount} {t('result.songs')}</p>
                        </div>
                    </div>

                    {/* Tab 栏 */}
                    <div
                        ref={tabScroll.ref}
                        onMouseDown={tabScroll.onMouseDown}
                        onMouseLeave={tabScroll.onMouseLeave}
                        onMouseUp={tabScroll.onMouseUp}
                        onMouseMove={tabScroll.onMouseMove}
                        className="flex gap-2 overflow-x-auto pb-3 no-scrollbar pt-1 cursor-grab select-none"
                    >
                        {GAMES.map(game => (
                            <GameTab
                                key={game.id}
                                game={game}
                                isActive={activeGameId === game.id}
                                count={results[game.id]?.matches?.length || 0}
                                onClick={() => {
                                    setActiveGameId(game.id);
                                    setTagFilter('all');
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== 内容区 ===== */}
            <div className="flex-1 overflow-y-auto scroll-touch safe-area-bottom">
                <div className="px-4 sm:px-6 lg:px-8 py-5">
                    {isMatching && rawMatches.length === 0 ? (
                        /* 匹配加载中 */
                        <div className="flex flex-col items-center justify-center h-64">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                                className="w-12 h-12 border-[5px] border-slate-200 border-t-cyan-500 rounded-full mb-4"
                            />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm animate-pulse">{t('playlist.analyzing')}...</p>
                        </div>
                    ) : (
                        <motion.div variants={containerStagger} initial="hidden" animate="visible" className="space-y-5">

                            {/* 搜索和筛选工具栏 */}
                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-100/80 p-3 shadow-sm">
                                <div className="flex flex-col sm:flex-row gap-2.5">
                                    {/* 搜索框 */}
                                    <div className="flex-1 relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder={t('result.searchPlaceholder')}
                                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50/80 border border-transparent focus:border-cyan-300 focus:bg-white focus:outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* 排序 */}
                                    <div className="relative flex-shrink-0">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                                            className="appearance-none pl-9 pr-7 py-2 rounded-xl bg-slate-50/80 border border-transparent focus:border-cyan-300 focus:bg-white focus:outline-none text-sm font-bold text-slate-600 cursor-pointer transition-all"
                                        >
                                            {SORT_OPTION_KEYS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                                            ))}
                                        </select>
                                        <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                        <ChevronRight size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none rotate-90" />
                                    </div>

                                    {/* 筛选按钮 */}
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all flex-shrink-0 ${showFilters || filterBy !== 'all' || tagFilter !== 'all'
                                            ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/25'
                                            : 'bg-slate-50/80 text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        <SlidersHorizontal size={14} />
                                        <span>{t('result.filterBtn')}</span>
                                        {(filterBy !== 'all' || tagFilter !== 'all') && (
                                            <span className="bg-white/25 px-1.5 py-0.5 rounded text-[10px] font-black">
                                                {(filterBy !== 'all' ? 1 : 0) + (tagFilter !== 'all' ? 1 : 0)}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {/* 筛选选项展开 */}
                                <AnimatePresence>
                                    {showFilters && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-3 mt-3 border-t border-slate-100 space-y-3">
                                                {/* 匹配类型 */}
                                                <div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('result.matchType')}</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {FILTER_OPTION_KEYS.map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => setFilterBy(opt.value)}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterBy === opt.value
                                                                    ? `${opt.color} text-white shadow-sm`
                                                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                {filterBy === opt.value && <Check size={12} />}
                                                                <span>{t(opt.labelKey)}</span>
                                                                <span className={`text-[10px] px-1 py-0.5 rounded ${filterBy === opt.value ? 'bg-white/25' : 'bg-slate-200/60'}`}>
                                                                    {opt.value === 'all' ? rawMatches.length : opt.value === 'exact' ? exactCount : fuzzyCount}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* 标签筛选 */}
                                                <div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                        <Tag size={10} />
                                                        {t('filter.byTag')}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {TAG_FILTER_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => setTagFilter(opt.value)}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tagFilter === opt.value
                                                                    ? `${opt.bgColor} ${opt.color} ring-1 ring-current/30 shadow-sm`
                                                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                {tagFilter === opt.value && <Check size={12} />}
                                                                <span>{t(opt.labelKey)}</span>
                                                                <span className={`text-[10px] px-1 py-0.5 rounded ${tagFilter === opt.value ? 'bg-black/8' : 'bg-slate-200/60'}`}>
                                                                    {tagCounts[opt.value] || 0}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* 筛选结果提示 */}
                                {hasActiveFilters && (
                                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                        <p className="text-[11px] font-medium text-slate-400">
                                            {t('result.showing')} <span className="text-cyan-600 font-bold">{filteredAndSortedMatches.length}</span> {t('result.of')} {rawMatches.length} {t('result.matches')}
                                        </p>
                                        <button
                                            onClick={() => { setSearchQuery(''); setFilterBy('all'); setTagFilter('all'); }}
                                            className="text-[11px] font-bold text-cyan-500 hover:text-cyan-600 transition-colors"
                                        >
                                            {t('result.clearFilter')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ===== 匹配结果网格 ===== */}
                            <div
                                key={activeGameId}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                            >
                                {filteredAndSortedMatches.map((match, idx) => (
                                    <motion.div
                                        key={`${activeGameId}-${match?.arcadeSong?.id || match?.userSong?.id || idx}`}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25, delay: Math.min(idx * 0.015, 0.3) }}
                                    >
                                        <MatchCard match={match} onClick={onSelectSong} />
                                    </motion.div>
                                ))}
                            </div>

                            {/* 空状态 */}
                            {filteredAndSortedMatches.length === 0 && rawMatches.length > 0 && (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                                        <Search className="text-slate-300" size={28} />
                                    </div>
                                    <p className="text-slate-400 font-bold text-sm">{t('result.noMatchDesc')}</p>
                                    <button
                                        onClick={() => { setSearchQuery(''); setFilterBy('all'); setTagFilter('all'); }}
                                        className="mt-3 text-sm font-bold text-cyan-500 hover:text-cyan-600 transition-colors"
                                    >
                                        {t('result.clearFilter')}
                                    </button>
                                </div>
                            )}

                            {rawMatches.length === 0 && !isMatching && (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                                        <Disc3 className="text-slate-300" size={28} />
                                    </div>
                                    <p className="text-slate-400 font-bold text-sm">{t('result.noMatchInGame')}</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>

            {/* 悬浮分享按钮 */}
            <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 20 }}
                onClick={() => setShowShareModal(true)}
                className="fixed bottom-6 right-6 z-40 w-13 h-13 bg-gradient-to-br from-pink-500 to-purple-500 text-white rounded-2xl shadow-lg shadow-pink-500/25 flex items-center justify-center hover:scale-105 hover:shadow-xl hover:shadow-pink-500/35 transition-all"
                title={t('share.title')}
            >
                <Share2 size={22} />
            </motion.button>

            {/* 分享模态框 */}
            <AnimatePresence>
                {showShareModal && (
                    <ShareModal
                        playlist={playlist}
                        results={results}
                        onClose={() => setShowShareModal(false)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
