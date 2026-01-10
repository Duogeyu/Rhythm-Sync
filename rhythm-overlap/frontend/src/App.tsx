import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Check
} from 'lucide-react';
import { getUserPlaylists, getPlaylistSongs, startMatchStream, getMatchStreamUrl, getSongUrl, type MatchItem, type UserPlaylist, type GameMatchResult } from './services/api';

// --- CONFIG & THEME ---
const GAMES = [
  { id: 'maimai', name: 'maimai DX (国际)', color: 'from-[#FFD700] to-[#FFA500]', ringColor: '#FFD700', icon: 'M' },
  { id: 'maimai-cn', name: 'maimai DX (国服)', color: 'from-[#FF8C00] to-[#FF6347]', ringColor: '#FF8C00', icon: 'M' },
  { id: 'chunithm', name: 'CHUNITHM', color: 'from-[#00CED1] to-[#20B2AA]', ringColor: '#00CED1', icon: 'C' },
  { id: 'ongeki', name: 'ONGEKI', color: 'from-[#9932CC] to-[#8B008B]', ringColor: '#9932CC', icon: 'O' },
  { id: 'taiko', name: '太鼓の達人', color: 'from-[#FF6347] to-[#DC143C]', ringColor: '#FF6347', icon: 'T' },
];

// --- ANIMATION ---
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
        音游歌单<span className="text-cyan-500">同步</span>
      </h1>
      <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-xs">
        Rhythm Game Playlist Sync
      </p>

      <div className="w-full max-w-sm relative">
        <div className="absolute inset-0 bg-slate-800 rounded-xl transform translate-x-1 translate-y-1" />
        <div className="relative bg-white border-[3px] border-slate-800 rounded-xl overflow-hidden flex shadow-lg">
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入网易云 UID..."
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
          <h2 className="text-3xl font-black text-slate-800 italic uppercase">选择歌单</h2>
          <div className="h-1.5 w-20 bg-gradient-to-r from-cyan-400 to-transparent mt-1 rounded-full" />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-[6px] border-slate-200 border-t-cyan-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-bold">读取中...</p>
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
                  <div className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Created by
                  </div>
                  <span className="text-xs font-bold text-slate-400 truncate">{playlist.creator}</span>
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

// 难度颜色配置
const DIFFICULTY_COLORS: Record<string, string> = {
  'Basic': 'bg-green-500',
  'Advanced': 'bg-yellow-500',
  'Expert': 'bg-red-500',
  'Master': 'bg-purple-500',
  'Re:Master': 'bg-fuchsia-400',
  'Ultima': 'bg-black',
  'Lunatic': 'bg-pink-500',
  'かんたん': 'bg-red-400',
  'ふつう': 'bg-yellow-500',
  'むずかしい': 'bg-green-500',
  'おに': 'bg-pink-600',
  '裏おに': 'bg-purple-600',
};

const getDifficultyColor = (diff: string): string => {
  return DIFFICULTY_COLORS[diff] || 'bg-slate-500';
};

const MatchCard: React.FC<MatchCardProps> = ({ match, onClick }) => {
  // 防止无效数据导致渲染崩溃
  if (!match || !match.arcadeSong || !match.userSong) {
    console.error('Invalid match data:', match);
    return null;
  }

  const isExact = match.matchType === 'exact';

  // 安全获取所有可能是对象的字段
  const category = safeString(match.arcadeSong.category, 'UNKNOWN');
  const title = safeString(match.arcadeSong.title, 'Unknown Title');
  const artist = safeString(match.arcadeSong.artist, 'Unknown Artist');
  const version = safeString(match.arcadeSong.version, 'Ver.UNKNOWN');
  const bpm = formatBpm(match.arcadeSong.bpm);
  const songType = match.arcadeSong.type || '';
  const charts = match.arcadeSong.charts || [];
  const levels = match.arcadeSong.levels || [];

  return (
    <motion.div
      variants={itemPop}
      layoutId={`card-${match.userSong.id}`}
      onClick={() => onClick(match)}
      className="group relative cursor-pointer"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={appleSpring}
    >
      {/* Shadow/Depth Layer */}
      <div className="absolute inset-0 bg-slate-800/20 rounded-2xl transform translate-x-2 translate-y-2 blur-sm" />

      <div className={`
        relative bg-white rounded-2xl overflow-hidden border-[3px] 
        ${isExact ? 'border-pink-400 shadow-[0_0_15px_rgba(244,114,182,0.4)]' : 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]'} 
        transition-all duration-300
      `}>
        {/* Header Bar */}
        <div className={`h-8 px-3 flex items-center justify-between relative overflow-hidden ${isExact ? 'bg-pink-500' : 'bg-yellow-400'}`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-shine" />
          <div className="flex items-center gap-2 relative z-10">
            <span className="text-white text-[10px] font-black uppercase tracking-wider drop-shadow-sm">
              {category}
            </span>
            {songType && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${songType === 'DX' ? 'bg-orange-400' : 'bg-blue-400'} text-white`}>
                {songType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 relative z-10">
            {isExact && <Star size={12} fill="white" className="text-white drop-shadow-sm" />}
            <span className="text-white text-[10px] font-black drop-shadow-sm">{isExact ? 'PERFECT' : 'POSSIBLE'}</span>
          </div>
        </div>

        <div className="p-3 flex items-center gap-3 bg-gradient-to-br from-white to-slate-50">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-slate-200 group-hover:shadow-lg transition-shadow">
            {/* 网易云封面（主封面） */}
            <img 
              src={match.userSong.coverUrl} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== match.arcadeSong.coverUrl && match.arcadeSong.coverUrl) {
                  target.src = match.arcadeSong.coverUrl;
                }
              }}
            />
            {/* 游戏封面（右下角小图） */}
            {match.arcadeSong.coverUrl && (
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-tl-lg overflow-hidden border-t-2 border-l-2 border-white shadow-lg bg-slate-300 z-10">
                <img 
                  src={match.arcadeSong.coverUrl}
                  className="w-full h-full object-cover"
                  onError={(e) => e.currentTarget.style.display = 'none'}
                />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-black text-slate-800 truncate text-sm leading-tight group-hover:text-cyan-600 transition-colors">{title}</h4>
            <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">{artist}</p>

            {/* 难度指示器 */}
            {(charts.length > 0 || levels.length > 0) && (
              <div className="flex items-center gap-1 mt-1.5">
                {charts.length > 0 ? (
                  charts.slice(0, 5).map((chart: any, i: number) => (
                    <div 
                      key={i} 
                      className={`w-6 h-5 rounded text-[9px] font-black text-white flex items-center justify-center ${getDifficultyColor(chart.difficulty)}`}
                      title={`${chart.difficulty}: ${chart.level} (${chart.ds})`}
                    >
                      {chart.level}
                    </div>
                  ))
                ) : (
                  levels.slice(0, 5).map((lv: string, i: number) => (
                    <div 
                      key={i} 
                      className={`w-6 h-5 rounded text-[9px] font-black text-white flex items-center justify-center ${
                        ['bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-fuchsia-400'][i] || 'bg-slate-500'
                      }`}
                    >
                      {lv}
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500">
                {version}
              </span>
              {bpm !== '-' && (
                <span className="px-1.5 py-0.5 bg-cyan-50 rounded text-[9px] font-black text-cyan-600">
                  ♪{bpm}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center w-10 flex-shrink-0">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="20" cy="20" r="16" stroke="#e2e8f0" strokeWidth="3" fill="transparent" />
                <circle cx="20" cy="20" r="16" stroke={isExact ? '#ec4899' : '#facc15'} strokeWidth="3" fill="transparent"
                  strokeDasharray={100} strokeDashoffset={100 - ((match.score || 0) * 100)}
                  strokeLinecap="round"
                  className="drop-shadow-sm transition-all duration-1000 ease-out"
                />
              </svg>
              <span className={`absolute text-[9px] font-black ${isExact ? 'text-pink-500' : 'text-yellow-500'}`}>
                {((match.score || 0) * 100).toFixed(0)}
              </span>
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

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'score-desc', label: '分数 (高→低)' },
  { value: 'score-asc', label: '分数 (低→高)' },
  { value: 'title-asc', label: '曲名 (A→Z)' },
  { value: 'title-desc', label: '曲名 (Z→A)' },
  { value: 'artist-asc', label: '艺术家 (A→Z)' },
];

const FILTER_OPTIONS: { value: FilterOption; label: string; color: string }[] = [
  { value: 'all', label: '全部', color: 'bg-slate-500' },
  { value: 'exact', label: '精确匹配', color: 'bg-pink-500' },
  { value: 'fuzzy', label: '模糊匹配', color: 'bg-yellow-500' },
];

const ResultStep: React.FC<ResultStepProps> = ({ playlist, results, isMatching, onBack, onSelectSong }) => {
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
              <span className="text-sm">重选歌单</span>
            </button>
            <div className="text-right">
              <h1 className="text-xl font-black text-slate-800 italic uppercase truncate max-w-[200px]">{playlist.name}</h1>
              <p className="text-xs font-bold text-slate-400">Total {playlist.trackCount} Songs</p>
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
              <p className="text-slate-400 font-black uppercase tracking-widest animate-pulse">分析中...</p>
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
                    <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">覆盖率</div>
                    <div className="text-5xl font-black italic tracking-tighter">
                      {coveragePercent}<span className="text-2xl">%</span>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-white/30 hidden sm:block" />
                  <div>
                    <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">已匹配</div>
                    <div className="text-3xl font-black">{rawMatches.length} <span className="text-base font-normal opacity-80">Songs</span></div>
                  </div>
                  <div className="h-10 w-px bg-white/30 hidden sm:block" />
                  <div className="flex gap-3">
                    <div className="text-center">
                      <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">精确</div>
                      <div className="text-2xl font-black">{exactCount}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">模糊</div>
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
                      placeholder="搜索歌曲名或艺术家..."
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
                      {SORT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <ChevronRight size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                  </div>

                  {/* 筛选按钮 */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                      showFilters || filterBy !== 'all'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <SlidersHorizontal size={16} />
                    <span>筛选</span>
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
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">匹配类型</div>
                        <div className="flex flex-wrap gap-2">
                          {FILTER_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setFilterBy(opt.value)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                filterBy === opt.value
                                  ? `${opt.color} text-white shadow-md`
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {filterBy === opt.value && <Check size={14} />}
                              <span>{opt.label}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                filterBy === opt.value ? 'bg-white/30' : 'bg-slate-200'
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
                      显示 <span className="text-cyan-600">{filteredAndSortedMatches.length}</span> / {rawMatches.length} 首匹配
                    </p>
                    {(searchQuery || filterBy !== 'all') && (
                      <button
                        onClick={() => { setSearchQuery(''); setFilterBy('all'); }}
                        className="text-xs font-bold text-cyan-500 hover:text-cyan-600"
                      >
                        清除筛选
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
                  <p className="text-slate-400 font-bold">没有找到匹配的结果</p>
                  <button
                    onClick={() => { setSearchQuery(''); setFilterBy('all'); }}
                    className="mt-2 text-sm font-bold text-cyan-500 hover:text-cyan-600"
                  >
                    清除筛选条件
                  </button>
                </div>
              )}

              {rawMatches.length === 0 && !isMatching && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                  <AlertCircle className="mx-auto mb-2 text-slate-300" size={48} />
                  <p className="text-slate-400 font-bold">没有找到匹配歌曲</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// 翻转卡片组件
interface FlipCardProps {
  frontImage: string;
  label?: string;
  backContent: React.ReactNode;
  fallbackImage?: string;
  autoFlip?: boolean; // 是否自动翻转
  autoFlipDelay?: number; // 自动翻转延迟（毫秒）
}

const FlipCard: React.FC<FlipCardProps> = ({ 
  frontImage, 
  label, 
  backContent, 
  fallbackImage,
  autoFlip = false,
  autoFlipDelay = 2000
}) => {
  const [isFlipped, setIsFlipped] = useState(autoFlip);

  // 自动翻转效果
  useEffect(() => {
    if (autoFlip) {
      // 开始时翻转显示背面
      setIsFlipped(true);
      // 延迟后翻回正面
      const timer = setTimeout(() => {
        setIsFlipped(false);
      }, autoFlipDelay);
      return () => clearTimeout(timer);
    }
  }, [autoFlip, autoFlipDelay]);

  return (
    <div className="w-40 h-40 cursor-pointer group perspective-1000" onClick={() => setIsFlipped(!isFlipped)}>
      <motion.div
        initial={autoFlip ? { rotateY: 180 } : false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: iosEase }}
        style={{ transformStyle: "preserve-3d" }}
        className="relative w-full h-full"
      >
        {/* Front */}
        <div 
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl border-4 border-white bg-slate-200 group-hover:shadow-2xl transition-shadow"
            style={{ backfaceVisibility: "hidden" }}
        >
           <img 
             src={frontImage} 
             className="w-full h-full object-cover" 
             onError={(e) => {
               if (fallbackImage && e.currentTarget.src !== fallbackImage) {
                 e.currentTarget.src = fallbackImage;
               }
             }}
           />
           {label && (
             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-2 px-2 text-center">
               <div className="text-white text-[10px] font-black uppercase tracking-widest drop-shadow-md">{label}</div>
             </div>
           )}
           <div className="absolute top-2 right-2 w-7 h-7 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
             <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
           </div>
        </div>

        {/* Back */}
        <div 
            className="absolute inset-0 rounded-2xl bg-white shadow-xl border-4 border-slate-100 p-4 flex flex-col items-center justify-center text-center overflow-hidden"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
           <div className="w-full h-full flex flex-col items-center justify-center relative">
             <div className="absolute inset-0 bg-slate-50 opacity-50 -z-10 bg-hex-pattern" />
             {backContent}
           </div>
        </div>
      </motion.div>
    </div>
  );
};

interface SongModalProps {
  match: MatchItem;
  onClose: () => void;
}

const SongModal: React.FC<SongModalProps> = ({ match, onClose }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (match) {
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

  // 获取难度数据
  const charts = match.arcadeSong.charts || [];
  const songType = match.arcadeSong.type || '';
  const isNew = match.arcadeSong.isNew;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto py-8"
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />

      <motion.div
        layoutId={`card-${match.userSong.id}`}
        initial={{ scale: 0.8, y: 50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={appleSpring}
        className="relative w-full max-w-3xl bg-white/95 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white/50 ring-1 ring-white/20 p-6 md:p-8 my-auto"
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-20 w-10 h-10 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full flex items-center justify-center text-slate-400 transition-all duration-300 shadow-sm active:scale-90">
          <X size={20} strokeWidth={3} />
        </button>

        {/* 标签区 */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {songType && (
            <span className={`text-xs font-black px-3 py-1 rounded-full ${songType === 'DX' ? 'bg-orange-500' : 'bg-blue-500'} text-white`}>
              {songType}
            </span>
          )}
          {isNew && (
            <span className="text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white">
              NEW
            </span>
          )}
          <span className="text-xs font-black px-3 py-1 rounded-full bg-slate-200 text-slate-600">
            {match.arcadeSong.category || 'UNKNOWN'}
          </span>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 mb-6">
          {/* Left: Source (NetEase) */}
          <FlipCard 
            frontImage={match.userSong.coverUrl} 
            fallbackImage={match.arcadeSong.coverUrl}
            label="NETEASE MUSIC"
            autoFlip={true}
            autoFlipDelay={2000}
            backContent={
              <>
                <div className="text-[10px] text-cyan-500 font-black uppercase mb-1 tracking-wider">Song</div>
                <div className="font-black text-slate-800 text-sm leading-tight mb-2 line-clamp-2">{match.userSong.name}</div>
                <div className="text-[10px] text-cyan-500 font-black uppercase mb-1 tracking-wider">Artist</div>
                <div className="text-xs font-bold text-slate-600 line-clamp-2">{match.userSong.artists}</div>
                <div className="text-[10px] text-cyan-500 font-black uppercase mb-1 mt-2 tracking-wider">Album</div>
                <div className="text-[10px] font-bold text-slate-500 line-clamp-1">{match.userSong.album || '-'}</div>
              </>
            }
          />

          {/* Middle: Arrow */}
          <div className="flex flex-col items-center justify-center text-slate-300 relative">
             <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-full blur-xl" />
             <div className={`font-black text-4xl mb-2 ${match.matchType === 'exact' ? 'text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500' : 'text-slate-800'}`}>
                {((match.score || 0) * 100).toFixed(0)}<span className="text-xl">%</span>
             </div>
             
             <motion.div
               animate={{ x: [0, 5, 0] }}
               transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
             >
               <ArrowRight size={48} strokeWidth={4} className={match.matchType === 'exact' ? 'text-pink-400 drop-shadow-lg' : 'text-yellow-400 drop-shadow-md'} />
             </motion.div>

             <div className={`text-[10px] font-black uppercase mt-3 tracking-[0.2em] px-3 py-1 rounded-full ${match.matchType === 'exact' ? 'bg-pink-100 text-pink-600' : 'bg-yellow-100 text-yellow-600'}`}>
               {match.matchType === 'exact' ? 'PERFECT' : 'MATCH'}
             </div>
          </div>

          {/* Right: Target (Game) */}
          <FlipCard 
            frontImage={match.arcadeSong.coverUrl} 
            fallbackImage={match.userSong.coverUrl}
            label={match.arcadeSong.version || 'ARCADE'}
            autoFlip={true}
            autoFlipDelay={2000}
            backContent={
              <>
                <div className="text-[10px] text-pink-500 font-black uppercase mb-1 tracking-wider">Title</div>
                <div className="font-black text-slate-800 text-sm leading-tight mb-2 line-clamp-2">{match.arcadeSong.title}</div>
                <div className="text-[10px] text-pink-500 font-black uppercase mb-1 tracking-wider">Artist</div>
                <div className="text-xs font-bold text-slate-600 line-clamp-2">{match.arcadeSong.artist}</div>
                {match.arcadeSong.bpm && (
                  <div className="mt-2 px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-500">
                    ♪ BPM {formatBpm(match.arcadeSong.bpm)}
                  </div>
                )}
              </>
            }
          />
        </div>

        {/* 难度信息 */}
        {charts.length > 0 && (
          <div className="bg-slate-100/50 rounded-2xl p-4 mb-4">
            <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 text-center">Difficulty Levels</div>
            <div className="flex flex-wrap justify-center gap-2">
              {charts.map((chart: any, i: number) => (
                <div 
                  key={i}
                  className={`flex flex-col items-center p-2 rounded-xl ${getDifficultyColor(chart.difficulty)} text-white min-w-[60px]`}
                >
                  <div className="text-[10px] font-bold opacity-80">{chart.difficulty}</div>
                  <div className="text-lg font-black">{chart.level}</div>
                  {chart.ds && <div className="text-[10px] font-bold opacity-80">{chart.ds.toFixed(1)}</div>}
                  {chart.charter && chart.charter !== '-' && (
                    <div className="text-[8px] font-medium opacity-70 truncate max-w-[50px]" title={chart.charter}>
                      {chart.charter}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-50/50 rounded-2xl p-4 border border-white/60 shadow-inner">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
             <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100">
               <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
                 <Music size={16} />
               </div>
               <div className="min-w-0 flex-1">
                 <div className="text-[9px] font-bold text-slate-400 uppercase">Version</div>
                 <div className="font-bold text-slate-700 text-xs truncate">{match.arcadeSong.version || '-'}</div>
               </div>
             </div>
             
             <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100">
               <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
                 <Star size={16} />
               </div>
               <div className="min-w-0 flex-1">
                 <div className="text-[9px] font-bold text-slate-400 uppercase">Score</div>
                 <div className="font-bold text-slate-700 text-xs">{((match.score || 0) * 100).toFixed(1)}%</div>
               </div>
             </div>

             <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100">
               <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-black">
                 ♪
               </div>
               <div className="min-w-0 flex-1">
                 <div className="text-[9px] font-bold text-slate-400 uppercase">BPM</div>
                 <div className="font-bold text-slate-700 text-xs">{formatBpm(match.arcadeSong.bpm)}</div>
               </div>
             </div>

             <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100">
               <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 text-xs font-black">
                 #
               </div>
               <div className="min-w-0 flex-1">
                 <div className="text-[9px] font-bold text-slate-400 uppercase">ID</div>
                 <div className="font-bold text-slate-700 text-xs truncate">{match.arcadeSong.id || '-'}</div>
               </div>
             </div>
          </div>

          <button
            onClick={togglePlay}
            disabled={!audioUrl}
            className={`w-full font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all
               ${audioUrl
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white shadow-cyan-400/30'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            <span className="text-sm">{audioUrl ? (isPlaying ? 'PAUSE' : 'PLAY PREVIEW') : 'No Preview'}</span>
          </button>

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
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/50 backdrop-blur-sm">
          <div className="font-black italic text-xl tracking-tighter flex items-center gap-1 text-slate-800 cursor-pointer" onClick={() => setStep('input')}>
            <div className="w-3 h-6 bg-cyan-400 skew-x-12" />
            <div className="w-3 h-6 bg-pink-500 skew-x-12" />
            <span className="ml-2">RHYTHM<span className="text-cyan-500">SYNC</span></span>
          </div>

          <a href="https://github.com/DuoGeYu" target="_blank" className="text-xs font-bold text-slate-400 hover:text-cyan-500 transition-colors">
            MADE BY DUOGEYU
          </a>
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
