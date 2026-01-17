import { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Music, ArrowLeft, Search, X, ArrowUpDown, ChevronRight, SlidersHorizontal, Check, AlertCircle, Tag, Share2 } from 'lucide-react';
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
        const walk = (x - startX.current) * 1.5; // 滚动速度倍数
        ref.current.scrollLeft = scrollLeft.current - walk;
    }, []);

    return {
        ref,
        onMouseDown,
        onMouseLeave,
        onMouseUp,
        onMouseMove,
    };
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

// 排序和筛选选项
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

// 标签筛选选项
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
    
    // Tab 栏拖动滚动
    const tabScroll = useDragScroll();

    // 安全获取当前游戏的匹配结果
    const rawMatches = results[activeGameId]?.matches ?? [];
    const activeGameConfig = GAMES.find(g => g.id === activeGameId) || GAMES[0];

    // 统计各标签数量
    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = { all: rawMatches.length };
        rawMatches.forEach(m => {
            (m.tags || []).forEach(tag => {
                counts[tag] = (counts[tag] || 0) + 1;
            });
        });
        return counts;
    }, [rawMatches]);

    // 应用搜索、筛选和排序
    const filteredAndSortedMatches = useMemo(() => {
        let matches = [...rawMatches];

        // 1. 搜索过滤
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

        // 2. 类型筛选
        if (filterBy !== 'all') {
            matches = matches.filter(m => m.matchType === filterBy);
        }

        // 3. 标签筛选
        if (tagFilter !== 'all') {
            matches = matches.filter(m => m.tags?.includes(tagFilter));
        }

        // 4. 排序
        matches.sort((a, b) => {
            switch (sortBy) {
                case 'score-desc':
                    return (b.score || 0) - (a.score || 0);
                case 'score-asc':
                    return (a.score || 0) - (b.score || 0);
                case 'title-asc':
                    return (a.arcadeSong?.title || '').localeCompare(b.arcadeSong?.title || '');
                case 'title-desc':
                    return (b.arcadeSong?.title || '').localeCompare(a.arcadeSong?.title || '');
                case 'artist-asc':
                    return (a.arcadeSong?.artist || '').localeCompare(b.arcadeSong?.artist || '');
                default:
                    return 0;
            }
        });

        return matches;
    }, [rawMatches, searchQuery, filterBy, tagFilter, sortBy]);

    // 安全计算覆盖率
    const coveragePercent = playlist.trackCount > 0
        ? Math.round((rawMatches.length / playlist.trackCount) * 100)
        : 0;

    // 统计精确和模糊匹配数量
    const exactCount = rawMatches.filter(m => m.matchType === 'exact').length;
    const fuzzyCount = rawMatches.filter(m => m.matchType === 'fuzzy').length;

    return (
        <motion.div
            className="w-full max-w-5xl mx-auto h-full flex flex-col relative z-10"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
            <div className="bg-white/80 backdrop-blur-md pt-6 px-4 pb-4 border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-cyan-500 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><ArrowLeft size={16} strokeWidth={3} /></div>
                            <span className="text-sm">{t('result.reselect')}</span>
                        </button>
                        <div className="text-right">
                            <h1 className="text-xl font-black text-slate-800 italic uppercase truncate max-w-[200px]">{playlist.name}</h1>
                            <p className="text-xs font-bold text-slate-400">{t('common.total')} {playlist.trackCount} {t('result.songs')}</p>
                        </div>
                    </div>

                    {/* Tab 栏 - 机台图片显示在每个 tab 上方，支持鼠标拖动滚动 */}
                    <div 
                        ref={tabScroll.ref}
                        onMouseDown={tabScroll.onMouseDown}
                        onMouseLeave={tabScroll.onMouseLeave}
                        onMouseUp={tabScroll.onMouseUp}
                        onMouseMove={tabScroll.onMouseMove}
                        className="flex gap-2 overflow-x-auto pb-4 no-scrollbar pt-2 cursor-grab select-none"
                    >
                        {GAMES.map(game => (
                            <GameTab
                                key={game.id}
                                game={game}
                                isActive={activeGameId === game.id}
                                count={results[game.id]?.matches?.length || 0}
                                onClick={() => {
                                    setActiveGameId(game.id);
                                    // 切换游戏时重置标签筛选，避免筛选结果为空
                                    setTagFilter('all');
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 scroll-touch safe-area-bottom">
                <div className="max-w-4xl mx-auto">
                    {isMatching && rawMatches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                                className="w-12 h-12 border-[6px] border-slate-200 border-t-cyan-500 rounded-full mb-4"
                            />
                            <p className="text-slate-400 font-black uppercase tracking-widest animate-pulse">{t('playlist.analyzing')}...</p>
                        </div>
                    ) : (
                        <motion.div variants={containerStagger} initial="hidden" animate="visible" className="space-y-6">

                            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${activeGameConfig.color} p-6 text-white shadow-lg transform hover:scale-[1.01] transition-transform`}>
                                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-white/10 skew-x-12 transform translate-x-10" />
                                <div className="absolute -right-6 -bottom-6 opacity-20 rotate-12">
                                    <Music size={120} />
                                </div>

                                <div className="relative z-10 flex items-end gap-6 flex-wrap">
                                    <div>
                                        <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">{t('result.coverage')}</div>
                                        <div className="text-5xl font-black italic tracking-tighter">
                                            {coveragePercent}<span className="text-2xl">%</span>
                                        </div>
                                    </div>
                                    <div className="h-10 w-px bg-white/30 hidden sm:block" />
                                    <div>
                                        <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">{t('result.matched')}</div>
                                        <div className="text-3xl font-black">{rawMatches.length} <span className="text-base font-normal opacity-80">{t('result.songs')}</span></div>
                                    </div>
                                    <div className="h-10 w-px bg-white/30 hidden sm:block" />
                                    <div className="flex gap-3">
                                        <div className="text-center">
                                            <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">{t('result.exact')}</div>
                                            <div className="text-2xl font-black">{exactCount}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">{t('result.fuzzy')}</div>
                                            <div className="text-2xl font-black">{fuzzyCount}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 搜索和筛选工具栏 */}
                            <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    {/* 搜索框 */}
                                    <div className="flex-1 relative">
                                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder={t('result.searchPlaceholder')}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border-2 border-transparent focus:border-cyan-400 focus:bg-white focus:outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 transition-all"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* 排序下拉 */}
                                    <div className="relative">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                                            className="appearance-none pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 border-2 border-transparent focus:border-cyan-400 focus:bg-white focus:outline-none text-sm font-bold text-slate-700 cursor-pointer transition-all"
                                        >
                                            {SORT_OPTION_KEYS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                                            ))}
                                        </select>
                                        <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <ChevronRight size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                                    </div>

                                    {/* 筛选按钮 */}
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${showFilters || filterBy !== 'all' || tagFilter !== 'all'
                                            ? 'bg-cyan-500 text-white'
                                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        <SlidersHorizontal size={16} />
                                        <span>{t('result.filterBtn')}</span>
                                        {(filterBy !== 'all' || tagFilter !== 'all') && (
                                            <span className="bg-white/30 px-1.5 py-0.5 rounded text-[10px]">
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
                                            <div className="pt-4 mt-4 border-t border-slate-100 space-y-4">
                                                {/* 匹配类型筛选 */}
                                                <div>
                                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('result.matchType')}</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {FILTER_OPTION_KEYS.map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => setFilterBy(opt.value)}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterBy === opt.value
                                                                    ? `${opt.color} text-white shadow-md`
                                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                    }`}
                                                            >
                                                                {filterBy === opt.value && <Check size={14} />}
                                                                <span>{t(opt.labelKey)}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${filterBy === opt.value ? 'bg-white/30' : 'bg-slate-200'
                                                                    }`}>
                                                                    {opt.value === 'all' ? rawMatches.length :
                                                                        opt.value === 'exact' ? exactCount : fuzzyCount}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                
                                                {/* 标签筛选 */}
                                                <div>
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                                        <Tag size={12} />
                                                        {t('filter.byTag')}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {TAG_FILTER_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => setTagFilter(opt.value)}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tagFilter === opt.value
                                                                    ? `${opt.bgColor} ${opt.color} ring-2 ring-current shadow-sm`
                                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                    }`}
                                                            >
                                                                {tagFilter === opt.value && <Check size={14} />}
                                                                <span>{t(opt.labelKey)}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${tagFilter === opt.value ? 'bg-black/10' : 'bg-slate-200'
                                                                    }`}>
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

                                {/* 搜索结果提示 */}
                                {(searchQuery || filterBy !== 'all' || tagFilter !== 'all') && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <p className="text-xs font-bold text-slate-500">
                                            {t('result.showing')} <span className="text-cyan-600">{filteredAndSortedMatches.length}</span> {t('result.of')} {rawMatches.length} {t('result.matches')}
                                        </p>
                                        {(searchQuery || filterBy !== 'all' || tagFilter !== 'all') && (
                                            <button
                                                onClick={() => { setSearchQuery(''); setFilterBy('all'); setTagFilter('all'); }}
                                                className="text-xs font-bold text-cyan-500 hover:text-cyan-600"
                                            >
                                                {t('result.clearFilter')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div
                                key={activeGameId}
                                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                            >
                                {filteredAndSortedMatches.map((match, idx) => (
                                    <motion.div
                                        key={`${activeGameId}-${match?.arcadeSong?.id || match?.userSong?.id || idx}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                                    >
                                        <MatchCard match={match} onClick={onSelectSong} />
                                    </motion.div>
                                ))}
                            </div>

                            {filteredAndSortedMatches.length === 0 && rawMatches.length > 0 && (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                                    <Search className="mx-auto mb-2 text-slate-300" size={48} />
                                    <p className="text-slate-400 font-bold">{t('result.noMatchDesc')}</p>
                                    <button
                                        onClick={() => { setSearchQuery(''); setFilterBy('all'); setTagFilter('all'); }}
                                        className="mt-2 text-sm font-bold text-cyan-500 hover:text-cyan-600"
                                    >
                                        {t('result.clearFilter')}
                                    </button>
                                </div>
                            )}

                            {rawMatches.length === 0 && !isMatching && (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                                    <AlertCircle className="mx-auto mb-2 text-slate-300" size={48} />
                                    <p className="text-slate-400 font-bold">{t('result.noMatchInGame')}</p>
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
                className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full shadow-lg shadow-pink-500/30 flex items-center justify-center hover:scale-110 hover:shadow-xl hover:shadow-pink-500/40 transition-all"
                title={t('share.title')}
            >
                <Share2 size={24} />
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
