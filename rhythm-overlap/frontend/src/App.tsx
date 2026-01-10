import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  ChevronRight,
  ArrowLeft,
  Play,
  Pause,
  X,
  Star,
  AlertCircle
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
const springBounce = { type: "spring", stiffness: 400, damping: 25 } as const;
const containerStagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemPop = {
  hidden: { y: 20, opacity: 0, scale: 0.8 },
  visible: { y: 0, opacity: 1, scale: 1, transition: springBounce }
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={springBounce}
    >
      <div className="relative mb-10 group">
        <div className="absolute inset-0 bg-cyan-400 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
        <div className="relative z-10 w-40 h-40 bg-white border-[6px] border-cyan-400 rounded-full flex items-center justify-center shadow-xl transform group-hover:scale-105 transition-transform duration-300">
          <div className="absolute inset-2 border-4 border-dashed border-slate-200 rounded-full animate-spin-slow" />
          <Music size={64} className="text-cyan-500 transform -rotate-12" />
          <div className="absolute -bottom-2 bg-yellow-400 text-white text-xs font-black px-3 py-1 rounded-full border-2 border-white shadow-sm uppercase tracking-wider">
            Touch To Start
          </div>
        </div>
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

interface MatchCardProps {
  match: MatchItem;
  onClick: (match: MatchItem) => void;
}

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
  const bpm = match.arcadeSong.bpm ? safeString(match.arcadeSong.bpm) : null;

  return (
    <motion.div
      variants={itemPop}
      onClick={() => onClick(match)}
      className="group relative cursor-pointer"
    >
      <div className="absolute inset-0 bg-slate-800 rounded-xl transform translate-x-1 translate-y-1" />

      <div className={`
        relative bg-white rounded-xl overflow-hidden border-[3px] 
        ${isExact ? 'border-pink-500' : 'border-yellow-400'} 
        hover:translate-x-[1px] hover:translate-y-[1px] transition-transform
      `}>
        <div className={`h-8 px-3 flex items-center justify-between ${isExact ? 'bg-pink-500' : 'bg-yellow-400'}`}>
          <span className="text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            {category}
          </span>
          <div className="flex items-center gap-1">
            {isExact && <Star size={12} fill="white" className="text-white" />}
            <span className="text-white text-xs font-black">{isExact ? 'PERFECT SYNC' : 'POSSIBLE'}</span>
          </div>
        </div>

        <div className="p-3 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-100 flex-shrink-0">
            <img src={match.arcadeSong.coverUrl || match.userSong.coverUrl} className="w-full h-full object-cover bg-slate-200" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-black text-slate-800 truncate text-sm leading-tight">{title}</h4>
            <p className="text-xs font-bold text-slate-400 truncate mt-0.5">{artist}</p>

            <div className="flex items-center gap-2 mt-2">
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-600 border border-slate-200">
                {version}
              </span>
              {bpm && (
                <span className="px-1.5 py-0.5 bg-cyan-50 rounded text-[10px] font-black text-cyan-600 border border-cyan-100">
                  BPM {bpm}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center w-12 flex-shrink-0">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="20" cy="20" r="16" stroke="#f1f5f9" strokeWidth="4" fill="transparent" />
                <circle cx="20" cy="20" r="16" stroke={isExact ? '#ec4899' : '#facc15'} strokeWidth="4" fill="transparent"
                  strokeDasharray={100} strokeDashoffset={100 - ((match.score || 0) * 100)}
                  className="drop-shadow-sm"
                />
              </svg>
              <span className="absolute text-[10px] font-black text-slate-700">
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

const ResultStep: React.FC<ResultStepProps> = ({ playlist, results, isMatching, onBack, onSelectSong }) => {
  const [activeGameId, setActiveGameId] = useState('maimai');

  const currentMatches = results[activeGameId] ? results[activeGameId].matches : [];
  const activeGameConfig = GAMES.find(g => g.id === activeGameId) || GAMES[0];

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
          {isMatching && currentMatches.length === 0 ? (
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

                <div className="relative z-10 flex items-end gap-6">
                  <div>
                    <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">覆盖率</div>
                    <div className="text-5xl font-black italic tracking-tighter">
                      {Math.round((currentMatches.length / playlist.trackCount) * 100)}<span className="text-2xl">%</span>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-white/30" />
                  <div>
                    <div className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">已匹配</div>
                    <div className="text-3xl font-black">{currentMatches.length} <span className="text-base font-normal opacity-80">Songs</span></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentMatches.map((match, idx) => (
                  <MatchCard key={match.arcadeSong.title + idx} match={match} onClick={onSelectSong} />
                ))}
              </div>

              {currentMatches.length === 0 && !isMatching && (
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

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        layoutId={`card-${match.userSong.id}`}
        initial={{ scale: 0.9, rotateX: 10, opacity: 0 }}
        animate={{ scale: 1, rotateX: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={springBounce}
        className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl border-[4px] border-white ring-4 ring-cyan-400/50"
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors border-2 border-white/20">
          <X size={20} strokeWidth={3} />
        </button>

        <div className="relative h-56">
          <img src={match.arcadeSong.coverUrl || match.userSong.coverUrl} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="inline-block px-2 py-0.5 bg-yellow-400 text-slate-900 text-[10px] font-black uppercase rounded mb-2 shadow-sm">
              {match.arcadeSong.category || 'MUSIC'}
            </div>
            <h2 className="text-2xl font-black leading-tight italic">{match.arcadeSong.title}</h2>
            <p className="text-white/80 font-bold mt-1">{match.arcadeSong.artist}</p>
          </div>
        </div>

        <div className="p-6 bg-slate-50">
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white p-3 rounded-lg border-2 border-slate-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-black uppercase">Version</div>
              <div className="font-bold text-slate-700 truncate">{match.arcadeSong.version || 'Unknown'}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border-2 border-slate-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-black uppercase">BPM</div>
              <div className="font-bold text-slate-700">{match.arcadeSong.bpm || '-'}</div>
            </div>
          </div>

          <div className="flex gap-1 h-2 mb-6 rounded-full overflow-hidden bg-slate-200">
            <div className="flex-1 bg-green-400 opacity-30" />
            <div className="flex-1 bg-yellow-400 opacity-30" />
            <div className="flex-1 bg-red-500 opacity-30" />
            <div className="flex-1 bg-purple-600" />
            <div className="flex-1 bg-violet-300 opacity-30" />
          </div>

          <button
            onClick={togglePlay}
            disabled={!audioUrl}
            className={`w-full font-black py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all
               ${audioUrl
                ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-cyan-200/50'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            <span>{audioUrl ? (isPlaying ? 'PAUSE PREVIEW' : 'PLAY PREVIEW') : 'No Preview Available'}</span>
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
