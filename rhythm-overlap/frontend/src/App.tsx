import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Music,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  X,
  Star,
  AlertCircle,
  Search,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  Check,
  Globe
} from 'lucide-react';
import { getUserPlaylists, getPlaylistSongs, startMatchStream, getMatchStreamUrl, getSongUrl, type MatchItem, type UserPlaylist, type GameMatchResult } from './services/api';

// --- 语言切换组件 ---
function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const switchLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    setIsOpen(false);
  };

  return (
    <div className="relative z-[300]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white/80 hover:text-white transition-all text-sm"
      >
        <Globe className="w-4 h-4" />
        <span>{t(`language.${i18n.language}`)}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* 点击外部关闭 */}
            <div
              className="fixed inset-0 z-[299]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute right-0 mt-2 py-1 bg-slate-800 rounded-lg shadow-xl border border-white/10 overflow-hidden z-[300] min-w-[120px]"
            >
              {['zh-CN', 'en-US'].map(lang => (
                <button
                  key={lang}
                  onClick={() => switchLanguage(lang)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${i18n.language === lang ? 'text-cyan-400' : 'text-white/80'
                    }`}
                >
                  {t(`language.${lang}`)}
                  {i18n.language === lang && <Check className="w-4 h-4" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- CONFIG & THEME ---
const GAMES = [
  {
    id: 'maimai',
    name: 'maimai DX (国际)',
    color: 'from-blue-400 to-cyan-400',
    ringColor: '#22d3ee',
    logoUrl: 'https://maimai.sega.jp/storage/root/logo.png'
  },
  {
    id: 'maimai-cn',
    name: 'maimai DX (国服)',
    color: 'from-orange-400 to-red-400',
    ringColor: '#fb923c',
    logoUrl: 'https://maimai.sega.jp/storage/root/logo.png' // 使用国际版 Logo（样式相同）
  },
  {
    id: 'chunithm',
    name: 'CHUNITHM',
    color: 'from-yellow-400 to-yellow-600',
    ringColor: '#facc15',
    logoUrl: 'https://chunithm.sega.jp/storage/top/pc/top_main_logo.webp'
  },
  {
    id: 'ongeki',
    name: 'ONGEKI',
    color: 'from-pink-400 to-purple-500',
    ringColor: '#e879f9',
    logoUrl: 'https://ongeki.sega.jp/assets/img/common/logo_main.webp'
  },
  {
    id: 'taiko',
    name: '太鼓の達人',
    color: 'from-red-500 to-red-700',
    ringColor: '#ef4444',
    logoUrl: 'https://taiko.namco-ch.net/taiko/tc/images/common/logo_nijiiro.png'
  },
];

// ... (保持动画配置不变)
// Apple-style non-linear animation settings
// "iOS" ease - distinct ease-out
const iosEase = [0.36, 0.66, 0.04, 1];
// "iOS" spring - snappy but smooth
const appleSpring = { type: "spring", stiffness: 350, damping: 35, mass: 1 };

const containerStagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, ease: iosEase } }
};
const itemPop = {
  hidden: { y: 20, opacity: 0, scale: 0.95 },
  visible: { y: 0, opacity: 1, scale: 1, transition: appleSpring }
};

// --- COMPONENTS ---

const Background = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-50">
    <div className="absolute inset-0 opacity-[0.03] bg-stripes-animation" />
    <motion.div
      animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[10%] left-[5%] text-cyan-200 opacity-20"
    >
      <Music size={120} />
    </motion.div>
    <motion.div
      animate={{ y: [0, 30, 0], rotate: [0, -15, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      className="absolute bottom-[15%] right-[5%] text-pink-200 opacity-20"
    >
      <Star size={100} fill="currentColor" />
    </motion.div>
    <div className="absolute inset-0 bg-hex-pattern opacity-[0.02]" />
  </div>
);

interface InputStepProps {
  onSearch: (uid: string) => void;
  isLoading: boolean;
}

const InputStep: React.FC<InputStepProps> = ({ onSearch, isLoading }) => {
  const [input, setInput] = useState('');
  const { t } = useTranslation();

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[70vh] w-full px-6 relative z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
      transition={{ duration: 0.5, ease: iosEase }}
    >
      <div className="relative mb-12 group">
        <div className="absolute inset-0 bg-cyan-400 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
        <motion.div
          className="relative z-10 w-44 h-44 bg-white/90 backdrop-blur-xl border-[6px] border-cyan-400 rounded-full flex items-center justify-center shadow-2xl shadow-cyan-400/30"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={appleSpring}
        >
          <div className="absolute inset-2 border-4 border-dashed border-slate-200 rounded-full animate-spin-slow" />
          <Music size={72} className="text-cyan-500 transform -rotate-12" />
          <motion.div
            className="absolute -bottom-3 bg-yellow-400 text-slate-900 text-sm font-black px-4 py-1.5 rounded-full border-4 border-white shadow-lg uppercase tracking-wider transform -rotate-3"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Touch To Start
          </motion.div>
        </motion.div>
      </div>

      <h1 className="text-4xl font-black text-slate-800 mb-2 italic tracking-tighter drop-shadow-sm">
        {t('app.titleMain')}<span className="text-cyan-500">{t('app.titleAccent')}</span>
      </h1>
      <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-xs">
        {t('app.subtitle')}
      </p>

      <div className="w-full max-w-sm relative">
        <div className="absolute inset-0 bg-slate-800 rounded-xl transform translate-x-1 translate-y-1" />
        <div className="relative bg-white border-[3px] border-slate-800 rounded-xl overflow-hidden flex shadow-lg">
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('input.placeholder')}
            className="flex-1 px-6 py-4 text-xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:bg-cyan-50 transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && input && !isLoading && onSearch(input)}
          />
          <button
            onClick={() => input && onSearch(input)}
            disabled={!input || isLoading}
            className="bg-cyan-400 px-6 flex items-center justify-center border-l-[3px] border-slate-800 hover:bg-cyan-300 active:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-400 transition-colors"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronRight size={28} className="text-white drop-shadow-md" strokeWidth={3} />
            )}
          </button>
        </div>
      </div>

      <div className="mt-8 flex gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
        <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce delay-100" />
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce delay-200" />
      </div>
    </motion.div>
  );
};

interface PlaylistStepProps {
  playlists: UserPlaylist[];
  onSelect: (playlist: UserPlaylist) => void;
  onBack: () => void;
  isLoading: boolean;
}

const PlaylistStep: React.FC<PlaylistStepProps> = ({ playlists, onSelect, onBack, isLoading }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      className="w-full max-w-4xl mx-auto px-4 pt-4 pb-20 relative z-10"
      variants={containerStagger}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} disabled={isLoading} className="w-12 h-12 bg-white border-[3px] border-slate-200 rounded-full flex items-center justify-center hover:border-cyan-400 hover:text-cyan-500 transition-all shadow-sm active:scale-95 disabled:opacity-50">
          <ArrowLeft size={24} strokeWidth={3} />
        </button>
        <div>
          <h2 className="text-3xl font-black text-slate-800 italic uppercase">{t('playlist.title')}</h2>
          <div className="h-1.5 w-20 bg-gradient-to-r from-cyan-400 to-transparent mt-1 rounded-full" />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-[6px] border-slate-200 border-t-cyan-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-bold">{t('common.loading')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {playlists.map((playlist) => (
          <motion.div
            key={playlist.id}
            variants={itemPop}
            onClick={() => !isLoading && onSelect(playlist)}
            className="group cursor-pointer bg-white relative overflow-hidden rounded-xl border-[3px] border-transparent hover:border-cyan-400 transition-all duration-200"
          >
            <div className="absolute inset-0 bg-slate-800 transform translate-x-1.5 translate-y-1.5 rounded-xl" />

            <div className="relative bg-white border-[3px] border-slate-200 group-hover:border-cyan-400 rounded-xl p-3 flex items-center gap-4 transition-colors">
              <div className="relative w-20 h-20 flex-shrink-0">
                <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover rounded-lg border-2 border-slate-100" />
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border border-white transform rotate-12">
                  {playlist.trackCount}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-slate-800 truncate group-hover:text-cyan-600 transition-colors">{playlist.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-400">{playlist.trackCount} {t('playlist.songs')}</span>
                </div>
              </div>

              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-cyan-400 group-hover:text-white transition-colors">
                <ChevronRight size={24} strokeWidth={3} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

interface GameTabProps {
  game: typeof GAMES[0];
  isActive: boolean;
  onClick: () => void;
  count: number;
}

const GameTab: React.FC<GameTabProps> = ({ game, isActive, onClick, count }) => (
  <button
    onClick={onClick}
    className="relative group outline-none focus:outline-none flex-shrink-0"
  >
    <div className={`
      relative h-10 px-6 transform -skew-x-12 flex items-center justify-center border-[3px] transition-all duration-200
      ${isActive
        ? 'bg-slate-800 border-slate-800 text-white shadow-lg translate-y-[-2px]'
        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}
    `}>
      <div className="transform skew-x-12 flex items-center gap-2">
        <span className={`font-black uppercase text-sm tracking-tight ${isActive ? 'text-cyan-400' : ''}`}>
          {game.name}
        </span>
        {count > 0 && (
          <span className={`text-[10px] px-1.5 rounded font-bold ${isActive ? 'bg-cyan-500 text-slate-900' : 'bg-slate-200 text-slate-500'}`}>
            {count}
          </span>
        )}
      </div>
    </div>
  </button>
);

// 安全字符串转换：处理可能是对象的字段
const safeString = (value: unknown, fallback = ''): string => {
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
const formatBpm = (bpm: any): string => {
  if (!bpm) return '-';
  if (typeof bpm === 'object' && bpm !== null) {
    if ('min' in bpm && 'max' in bpm) {
      return bpm.min === bpm.max ? String(bpm.min) : `${bpm.min}-${bpm.max}`;
    }
    return '-';
  }
  return String(bpm);
};

interface MatchCardProps {
  match: MatchItem;
  onClick: (match: MatchItem) => void;
}

// 难度颜色配置（对应 Maimai DX 颜色）
const DIFFICULTY_COLORS: Record<string, string> = {
  'Basic': 'bg-green-500',
  'Advanced': 'bg-yellow-500',
  'Expert': 'bg-red-500',
  'Master': 'bg-purple-500',
  'Re:Master': 'bg-fuchsia-400', // 白/粉
  'Ultima': 'bg-black',
  'Lunatic': 'bg-pink-500', // Ongeki Lunatic
  'かんたん': 'bg-red-400',
  'ふつう': 'bg-yellow-500',
  'むずかしい': 'bg-green-500',
  'おに': 'bg-pink-600',
  '裏おに': 'bg-purple-600',
};

const getDifficultyBg = (diff: string): string => {
  return DIFFICULTY_COLORS[diff] || 'bg-slate-400';
};

const MatchCard: React.FC<MatchCardProps> = ({ match, onClick }) => {
  // 防止无效数据导致渲染崩溃
  if (!match || !match.arcadeSong || !match.userSong) return null;

  const isExact = match.matchType === 'exact';

  // 提取数据
  const category = safeString(match.arcadeSong.category, 'UNKNOWN');
  const title = safeString(match.arcadeSong.title, 'Unknown Title');
  const artist = safeString(match.arcadeSong.artist, 'Unknown Artist');
  const version = safeString(match.arcadeSong.version, '');
  const bpm = formatBpm(match.arcadeSong.bpm);
  const charts = match.arcadeSong.charts || [];
  const levels = match.arcadeSong.levels || [];

  // 获取最高难度用于展示
  const maxLevel = charts.length > 0
    ? charts[charts.length - 1].level
    : levels.length > 0 ? levels[levels.length - 1] : '?';

  return (
    <motion.div
      variants={itemPop}
      layoutId={`card-${match.userSong.id}`}
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
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-tight truncate max-w-[120px]">
                  {category}
                </span>
                {version && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-50 text-cyan-600 truncate max-w-[100px]">
                    {version}
                  </span>
                )}
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
              {(charts.length > 0 ? charts : levels.map((l, i) => ({ level: l, difficulty: Object.keys(DIFFICULTY_COLORS)[i] }))).slice(0, 5).map((c: any, i: number) => (
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
};

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

// SORT_OPTIONS 和 FILTER_OPTIONS 在组件内使用 t() 动态生成
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

const ResultStep: React.FC<ResultStepProps> = ({ playlist, results, isMatching, onBack, onSelectSong }) => {
  const { t } = useTranslation();
  const [activeGameId, setActiveGameId] = useState('maimai');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('score-desc');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);

  // 安全获取当前游戏的匹配结果
  const rawMatches = results[activeGameId]?.matches ?? [];
  const activeGameConfig = GAMES.find(g => g.id === activeGameId) || GAMES[0];

  // 应用搜索、筛选和排序
  const filteredAndSortedMatches = React.useMemo(() => {
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

    // 3. 排序
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
  }, [rawMatches, searchQuery, filterBy, sortBy]);

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

          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar pl-1">
            {GAMES.map(game => (
              <GameTab
                key={game.id}
                game={game}
                isActive={activeGameId === game.id}
                count={results[game.id]?.matches?.length || 0}
                onClick={() => setActiveGameId(game.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
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
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${showFilters || filterBy !== 'all'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <SlidersHorizontal size={16} />
                    <span>{t('result.filterBtn')}</span>
                    {filterBy !== 'all' && (
                      <span className="bg-white/30 px-1.5 py-0.5 rounded text-[10px]">1</span>
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
                      <div className="pt-4 mt-4 border-t border-slate-100">
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
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 搜索结果提示 */}
                {(searchQuery || filterBy !== 'all') && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500">
                      {t('result.showing')} <span className="text-cyan-600">{filteredAndSortedMatches.length}</span> {t('result.of')} {rawMatches.length} {t('result.matches')}
                    </p>
                    {(searchQuery || filterBy !== 'all') && (
                      <button
                        onClick={() => { setSearchQuery(''); setFilterBy('all'); }}
                        className="text-xs font-bold text-cyan-500 hover:text-cyan-600"
                      >
                        {t('result.clearFilter')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                variants={containerStagger}
                initial="hidden"
                animate="visible"
                key={`${activeGameId}-${filterBy}-${sortBy}-${searchQuery}`} // 切换时重新触发动画
              >
                {filteredAndSortedMatches.map((match, idx) => (
                  <MatchCard key={`${match?.arcadeSong?.title || 'unknown'}-${idx}`} match={match} onClick={onSelectSong} />
                ))}
              </motion.div>

              {filteredAndSortedMatches.length === 0 && rawMatches.length > 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                  <Search className="mx-auto mb-2 text-slate-300" size={48} />
                  <p className="text-slate-400 font-bold">{t('result.noMatchDesc')}</p>
                  <button
                    onClick={() => { setSearchQuery(''); setFilterBy('all'); }}
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
    </motion.div>
  );
};

// BPM 可视化组件
const BpmVisualizer: React.FC<{ bpm: number }> = ({ bpm }) => {
  // 计算动画周期 (秒)，限制在合理范围内防止过快或过慢
  const safeBpm = Math.max(60, Math.min(bpm, 300));
  const duration = 60 / safeBpm;

  return (
    <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200">
      <div className="flex items-end gap-0.5 h-4">
        <motion.div
          className="w-1 bg-cyan-500 rounded-t-sm"
          animate={{ height: ["30%", "100%", "30%"] }}
          transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: 0 }}
        />
        <motion.div
          className="w-1 bg-cyan-500 rounded-t-sm"
          animate={{ height: ["30%", "100%", "30%"] }}
          transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: duration * 0.25 }}
        />
        <motion.div
          className="w-1 bg-cyan-500 rounded-t-sm"
          animate={{ height: ["30%", "100%", "30%"] }}
          transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: duration * 0.5 }}
        />
        <motion.div
          className="w-1 bg-cyan-500 rounded-t-sm"
          animate={{ height: ["30%", "100%", "30%"] }}
          transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: duration * 0.75 }}
        />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[9px] font-bold text-slate-400 uppercase">BPM</span>
        <span className="text-sm font-black text-slate-700">{bpm}</span>
      </div>
    </div>
  );
};

interface SongModalProps {
  match: MatchItem;
  onClose: () => void;
}

const SongModal: React.FC<SongModalProps> = ({ match, onClose }) => {
  const { t } = useTranslation();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
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
    // @ts-ignore
    if (rawBpm.max) bpmValue = rawBpm.max;
  }

  // 难度列表数据准备
  const difficultyList = charts.length > 0 ? charts : levels.map((lv, i) => ({
    difficulty: Object.keys(DIFFICULTY_COLORS)[i] || `Level ${i + 1}`,
    level: lv,
    ds: ds[i] || 0
  }));

  // 根据后端返回的 gameId 选择游戏配置
  const gameId = match.arcadeSong.gameId || 'maimai'; // 默认 maimai
  let gameConfig = GAMES.find(g => g.id === gameId) || GAMES[0];

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
        <div className="flex-1 p-6 md:p-8 flex flex-col min-w-0 bg-white relative">
          {/* 标题区 */}
          <div className="mb-6 pr-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight mb-2 line-clamp-2" title={match.arcadeSong.title}>
              {match.arcadeSong.title}
            </h2>
            <p className="text-sm font-bold text-slate-500 line-clamp-1" title={match.arcadeSong.artist}>
              {match.arcadeSong.artist}
            </p>
          </div>

          {/* 核心数据栏 */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <BpmVisualizer bpm={bpmValue} />
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase">{t('detail.version')}</div>
              <div className="text-xs font-black text-slate-700 truncate max-w-[120px]">{match.arcadeSong.version || '-'}</div>
            </div>
            {/* 来源确认 */}
            <div className="ml-auto flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
              <img src={match.userSong.coverUrl} className="w-5 h-5 rounded-sm" />
              <span className="text-[10px] font-bold text-slate-400">{t('detail.netease')}</span>
            </div>
          </div>

          {/* 难度展示区 - 游戏风格 */}
          <div className="flex-1 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('detail.difficulty')}</h3>
              {match.arcadeSong.type && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded text-white ${match.arcadeSong.type === 'DX' ? 'bg-orange-400' : 'bg-blue-400'}`}>
                  {match.arcadeSong.type}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {difficultyList.map((chart: any, i: number) => (
                <div
                  key={i}
                  className={`
                    relative flex flex-col items-center justify-center w-14 h-14 rounded-xl shadow-sm border-2 border-white ring-1 ring-slate-100
                    ${getDifficultyBg(chart.difficulty)} text-white overflow-hidden group hover:scale-110 transition-transform cursor-default
                  `}
                  title={`${chart.difficulty} ${chart.notes ? `(${chart.notes} notes)` : ''}`}
                >
                  <div className="absolute top-0 inset-x-0 h-1/2 bg-white/10" />
                  <div className="text-[9px] font-bold uppercase opacity-90 relative z-10 translate-y-[-2px]">
                    {chart.difficulty.substring(0, 3)}
                  </div>
                  <div className="text-xl font-black leading-none relative z-10 shadow-black drop-shadow-sm">
                    {chart.level}
                  </div>
                  {chart.ds > 0 && (
                    <div className="absolute bottom-0.5 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 px-1 rounded-full">
                      {typeof chart.ds === 'number' ? chart.ds.toFixed(1) : chart.ds}
                    </div>
                  )}
                </div>
              ))}
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
              <span>{audioUrl ? (isPlaying ? 'PAUSE' : 'PLAY PREVIEW') : 'NO PREVIEW'}</span>
            </button>

            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center items-center min-w-[80px]">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Match</span>
              <span className={`text-sm font-black ${match.matchType === 'exact' ? 'text-pink-500' : 'text-yellow-500'}`}>
                {((match.score || 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => setIsPlaying(false)} />
        </div>
      </motion.div>
    </motion.div>
  );
};

// Main App
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // 检查 localStorage 中是否已验证
    return localStorage.getItem('rhythm_overlap_auth') === 'verified';
  });
  const [step, setStep] = useState<'input' | 'playlist' | 'result'>('input');

  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<UserPlaylist | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paramResult, setParamResult] = useState<{
    playlistId: string;
    results: Record<string, GameMatchResult>;
  }>({
    playlistId: '',
    results: {}
  });
  const [isMatching, setIsMatching] = useState(false);
  const [selectedSong, setSelectedSong] = useState<MatchItem | null>(null);
  const [userId, setUserId] = useState(''); // 存储用户输入的网易云 ID
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // SSE Ref to avoid closure issues
  const paramResultRef = useRef(paramResult);
  useEffect(() => {
    paramResultRef.current = paramResult;
  }, [paramResult]);

  // 密码验证
  const handleVerifyPassword = async () => {
    if (!passwordInput.trim()) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`http://${window.location.hostname}:3002/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('rhythm_overlap_auth', 'verified');
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || '密码错误');
      }
    } catch {
      setAuthError('验证失败，请检查网络');
    } finally {
      setAuthLoading(false);
    }
  };

  // 如果未验证，显示密码界面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen font-sans bg-slate-100 flex items-center justify-center">
        <Background />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-white rounded-2xl shadow-xl p-8 w-80 border-4 border-slate-200"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-400 to-pink-500 rounded-full flex items-center justify-center mb-4">
              <Music size={32} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-800">访问验证</h1>
            <p className="text-sm text-slate-400 mt-1">请输入访问密码</p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
              placeholder="输入密码..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-cyan-400 focus:outline-none text-center font-bold text-lg"
              autoFocus
            />

            {authError && (
              <p className="text-red-500 text-sm text-center font-bold">{authError}</p>
            )}

            <button
              onClick={handleVerifyPassword}
              disabled={authLoading || !passwordInput.trim()}
              className="w-full py-3 bg-gradient-to-r from-cyan-400 to-pink-500 text-white font-black rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {authLoading ? '验证中...' : '进入'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleFetchPlaylists = async (uid: string) => {
    setIsLoading(true);
    try {
      const res = await getUserPlaylists(uid);
      if (res.success) {
        setPlaylists(res.playlists);
        setUserId(uid); // 保存用户 ID
        setStep('playlist');
      } else {
        alert('获取歌单失败: ' + res.error);
      }
    } catch (e) {
      alert('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlaylist = async (playlist: UserPlaylist) => {
    setSelectedPlaylist(playlist);
    setStep('result');
    setIsLoading(true); // Loading songs...

    // Reset results
    setParamResult({ playlistId: playlist.id.toString(), results: {} });

    try {
      // 1. Get Songs
      const songsRes = await getPlaylistSongs(playlist.id.toString());
      if (!songsRes.songs) {
        alert('获取歌曲失败');
        setStep('playlist');
        return;
      }

      // 2. Start Matching Stream
      const userSongs = songsRes.songs;
      const matchRes = await startMatchStream(userSongs, {
        neteaseUid: userId,
        playlistId: playlist.id.toString(),
        playlistName: playlist.name
      });

      if (!matchRes) {
        // handle error if needed
      }

      const sessionId = matchRes;

      setIsMatching(true);
      const eventSource = new EventSource(getMatchStreamUrl(sessionId));

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'batch_match') {
          // 后端发送批量匹配结果: [{ userSong, matches: { gameId: match } }]
          const batchResults = data.data;

          // 使用函数式更新确保从最新状态开始
          setParamResult(prev => {
            const newResults = { ...prev.results };

            batchResults.forEach((item: { userSong: unknown; matches: Record<string, MatchItem> }) => {
              Object.entries(item.matches).forEach(([gameId, match]) => {
                if (!newResults[gameId]) {
                  newResults[gameId] = {
                    config: { name: '', shortName: '', color: '' },
                    stats: null,
                    matches: []
                  } as GameMatchResult;
                }
                // 使用展开运算符创建新数组，确保 React 检测到变化
                newResults[gameId] = {
                  ...newResults[gameId],
                  matches: [...newResults[gameId].matches, match]
                };
              });
            });

            return { ...prev, results: newResults };
          });
        } else if (data.type === 'init') {
          // 初始化事件，可以用来设置 config
          const gameStats = data.data.gameStats;
          if (gameStats) {
            const current = paramResultRef.current;
            const newResults = { ...current.results };
            Object.entries(gameStats).forEach(([gameId, info]: [string, unknown]) => {
              const gameInfo = info as { config: { name: string; shortName: string; color: string } };
              if (!newResults[gameId]) {
                newResults[gameId] = {
                  config: gameInfo.config,
                  stats: null,
                  matches: []
                } as GameMatchResult;
              } else {
                newResults[gameId].config = gameInfo.config;
              }
            });
            setParamResult(prev => ({ ...prev, results: newResults }));
          }
        } else if (data.type === 'done') {
          setIsMatching(false);
          eventSource.close();
        } else if (data.type === 'error') {
          console.error('SSE Error:', data.message);
          setIsMatching(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        console.error('SSE Connection Error');
        setIsMatching(false);
        eventSource.close();
      };

    } catch (e) {
      console.error(e);
      alert('操作失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans text-slate-900 bg-slate-100 selection:bg-cyan-200 selection:text-cyan-900 overflow-hidden relative">
      <Background />

      <div className="relative z-10 h-screen flex flex-col">
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/50 backdrop-blur-sm relative z-[400]">
          <div className="font-black italic text-xl tracking-tighter flex items-center gap-1 text-slate-800 cursor-pointer" onClick={() => setStep('input')}>
            <div className="w-3 h-6 bg-cyan-400 skew-x-12" />
            <div className="w-3 h-6 bg-pink-500 skew-x-12" />
            <span className="ml-2">RHYTHM<span className="text-cyan-500">SYNC</span></span>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <a href="https://github.com/DuoGeYu" target="_blank" className="text-xs font-bold text-slate-400 hover:text-cyan-500 transition-colors">
              MADE BY DUOGEYU
            </a>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 'input' && <InputStep key="input" onSearch={handleFetchPlaylists} isLoading={isLoading} />}
            {step === 'playlist' && <PlaylistStep key="playlist" playlists={playlists} onSelect={handleSelectPlaylist} onBack={() => setStep('input')} isLoading={isLoading} />}
            {step === 'result' && selectedPlaylist && (
              <ResultStep
                key="result"
                playlist={selectedPlaylist}
                results={paramResult.results}
                isMatching={isMatching}
                onBack={() => setStep('playlist')}
                onSelectSong={setSelectedSong}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {selectedSong && <SongModal match={selectedSong} onClose={() => setSelectedSong(null)} />}
      </AnimatePresence>
    </div>
  );
}
