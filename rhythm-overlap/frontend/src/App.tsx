import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Music } from 'lucide-react';

// 组件导入
import Background from './components/Background';
import GameLogoMarquee from './components/GameLogoMarquee';
import LanguageSwitcher from './components/LanguageSwitcher';
import InputStep from './components/InputStep';
import PlaylistStep from './components/PlaylistStep';
import ResultStep from './components/ResultStep';
import SongModal from './components/SongModal';
import SharePage from './components/SharePage';

// API 导入
import {
  getPlaylistSongs,
  getPlaylistsByPlatform,
  getSongsByPlatform,
  getQQMusicPlaylist,
  parseTextSongs,
  startMatchStream,
  getMatchStreamUrl,
  type MatchItem,
  type UserPlaylist,
  type GameMatchResult,
  type PlatformType,
  type ParsedInput
} from './services/api';

// 解析 URL hash 获取分享 ID
function getShareIdFromHash(): string | null {
  const hash = window.location.hash;
  // 支持 #/share/xxx 和 #/share/xxx?render=true 两种格式
  const match = hash.match(/^#\/share\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// 解析 URL hash 获取结果 ID (机器人分享的完整结果页)
function getResultIdFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/^#\/result\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Main App
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
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
  const [userId, setUserId] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<PlatformType>('netease');
  const [textSongs, setTextSongs] = useState<{ id: string; name: string; artists: string; album: string; coverUrl: string; duration: number }[] | null>(null);
  
  // 分享页面状态
  const [shareId, setShareId] = useState<string | null>(() => getShareIdFromHash());
  // 结果页面状态 (机器人分享)
  const [resultId, setResultId] = useState<string | null>(() => getResultIdFromHash());
  const [loadedResultData, setLoadedResultData] = useState<{
    playlist: UserPlaylist;
    results: Record<string, GameMatchResult>;
  } | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const sId = getShareIdFromHash();
      const rId = getResultIdFromHash();
      setShareId(sId);
      setResultId(rId);
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 加载结果数据 (机器人分享)
  useEffect(() => {
    if (!resultId) {
      setLoadedResultData(null);
      return;
    }
    
    const loadResult = async () => {
      setResultLoading(true);
      setResultError(null);
      try {
        const res = await fetch(`http://${window.location.hostname}:3002/api/bot/result/${resultId}`);
        const data = await res.json();
        if (data.success) {
          setLoadedResultData({
            playlist: data.data.playlist,
            results: data.data.results
          });
          setSelectedPlaylist(data.data.playlist);
          setParamResult({ playlistId: data.data.playlist.id, results: data.data.results });
          setStep('result');
        } else {
          setResultError(data.error || '加载失败');
        }
      } catch (e) {
        setResultError('网络错误: ' + (e as Error).message);
      } finally {
        setResultLoading(false);
      }
    };
    
    loadResult();
  }, [resultId]);

  // 返回首页
  const handleBackToHome = () => {
    window.location.hash = '';
    setShareId(null);
    setResultId(null);
    setLoadedResultData(null);
  };

  // 如果是分享页面，显示分享内容
  if (shareId) {
    return <SharePage shareId={shareId} onBack={handleBackToHome} />;
  }

  // 如果正在加载结果数据
  if (resultId && resultLoading) {
    return (
      <div className="min-h-screen font-sans bg-slate-100 flex items-center justify-center">
        <Background />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 prism-card p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-600 font-bold">正在加载查询结果...</p>
        </motion.div>
      </div>
    );
  }

  // 如果加载结果失败
  if (resultId && resultError) {
    return (
      <div className="min-h-screen font-sans bg-slate-100 flex items-center justify-center">
        <Background />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 prism-card p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <p className="text-red-500 font-bold mb-4">{resultError}</p>
          <button onClick={handleBackToHome} className="prism-button px-6 py-2 rounded-xl font-bold">
            返回首页
          </button>
        </motion.div>
      </div>
    );
  }

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
          className="relative z-10 prism-card p-8 w-80"
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
              className="w-full py-3 prism-button rounded-xl font-black disabled:opacity-50"
            >
              {authLoading ? '验证中...' : '进入'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleFetchPlaylists = async (uid: string, platform?: PlatformType, parsedData?: ParsedInput) => {
    setIsLoading(true);
    const actualPlatform = platform || 'netease';
    setCurrentPlatform(actualPlatform);
    setTextSongs(null);
    
    try {
      // 文本导入 - 直接进入匹配 (支持 songlist 和 single 类型)
      if (actualPlatform === 'text' && (parsedData?.type === 'songlist' || parsedData?.type === 'single')) {
        // single 类型用 query，songlist 类型用 songs
        const textInput = parsedData.type === 'single' 
          ? (parsedData.query || '') 
          : (parsedData.songs?.join('\n') || '');
        const result = await parseTextSongs(textInput);
        setTextSongs(result.songs);
        // 创建虚拟歌单直接进入匹配
        const virtualPlaylist: UserPlaylist = {
          id: 'text_import',
          name: `文本导入 (${result.total} 首)`,
          coverUrl: '',
          trackCount: result.total,
          creator: '手动导入'
        };
        setPlaylists([virtualPlaylist]);
        setUserId('text');
        setSelectedPlaylist(virtualPlaylist);
        setStep('result');
        // 直接开始匹配
        await startMatchingWithSongs(result.songs, virtualPlaylist);
        return;
      }
      
      // QQ音乐 - 直接获取歌单内容
      if (actualPlatform === 'qqmusic') {
        const playlistId = parsedData?.id || uid;
        const result = await getQQMusicPlaylist(playlistId);
        const playlist: UserPlaylist = {
          id: result.playlist.id,
          name: result.playlist.name,
          coverUrl: result.playlist.coverUrl,
          trackCount: result.total,
          creator: result.playlist.creator
        };
        setPlaylists([playlist]);
        setUserId(playlistId);
        setStep('playlist');
        return;
      }
      
      // 网易云歌单直链 - 直接获取歌单内容
      if (actualPlatform === 'netease' && parsedData?.type === 'playlist') {
        const playlistId = parsedData.id!;
        const result = await getPlaylistSongs(playlistId);
        // 创建虚拟歌单项
        const playlist: UserPlaylist = {
          id: playlistId,
          name: `歌单 #${playlistId}`,
          coverUrl: result.songs[0]?.coverUrl || '',
          trackCount: result.total,
          creator: '分享链接'
        };
        setPlaylists([playlist]);
        setUserId(playlistId);
        setStep('playlist');
        return;
      }
      
      // 网易云/B站 - 获取用户歌单列表
      const id = parsedData?.id || uid;
      const res = await getPlaylistsByPlatform(actualPlatform, id);
      if (res.success) {
        setPlaylists(res.playlists);
        setUserId(id);
        setStep('playlist');
      } else {
        alert('获取歌单失败: ' + res.error);
      }
    } catch (e) {
      console.error(e);
      alert('网络错误: ' + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 直接用歌曲开始匹配（文本导入用）
  const startMatchingWithSongs = async (songs: { id: string | number; name: string; artists: string; album: string; coverUrl: string; duration: number }[], playlist: UserPlaylist) => {
    setParamResult({ playlistId: 'text_import', results: {} });
    
    try {
      // 转换 id 类型以兼容 API
      const normalizedSongs = songs.map(s => ({ ...s, id: typeof s.id === 'string' ? parseInt(s.id, 10) || 0 : s.id }));
      const matchRes = await startMatchStream(normalizedSongs, {
        neteaseUid: 'text_import',
        playlistId: 'text_import',
        playlistName: playlist.name
      });

      const sessionId = matchRes;
      setIsMatching(true);
      const eventSource = new EventSource(getMatchStreamUrl(sessionId));

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'batch_match') {
          const batchResults = data.data;

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
                newResults[gameId] = {
                  ...newResults[gameId],
                  matches: [...newResults[gameId].matches, match]
                };
              });
            });

            return { ...prev, results: newResults };
          });
        } else if (data.type === 'init') {
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
      alert('匹配失败');
    }
  };

  const handleSelectPlaylist = async (playlist: UserPlaylist) => {
    setSelectedPlaylist(playlist);
    setStep('result');
    setIsLoading(true);

    // Reset results
    setParamResult({ playlistId: playlist.id.toString(), results: {} });

    try {
      // 1. Get Songs (根据平台选择 API)
      let userSongs;
      
      if (textSongs && playlist.id === 'text_import') {
        // 文本导入已经有歌曲数据
        userSongs = textSongs;
      } else {
        const songsRes = await getSongsByPlatform(currentPlatform, playlist.id.toString());
        if (!songsRes.songs) {
          alert('获取歌曲失败');
          setStep('playlist');
          return;
        }
        userSongs = songsRes.songs;
      }

      // 2. Start Matching Stream
      const matchRes = await startMatchStream(userSongs, {
        neteaseUid: userId,
        playlistId: playlist.id.toString(),
        playlistName: playlist.name
      });

      const sessionId = matchRes;

      setIsMatching(true);
      const eventSource = new EventSource(getMatchStreamUrl(sessionId));

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'batch_match') {
          const batchResults = data.data;

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
                newResults[gameId] = {
                  ...newResults[gameId],
                  matches: [...newResults[gameId].matches, match]
                };
              });
            });

            return { ...prev, results: newResults };
          });
        } else if (data.type === 'init') {
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
    <div className="min-h-screen font-sans text-slate-900 bg-transparent selection:bg-cyan-200 selection:text-cyan-900 overflow-hidden relative">
      <Background />

      <div className="relative z-10 h-screen flex flex-col">
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/40 backdrop-blur-md relative z-[400] bg-white/20">
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
                onBack={() => {
                  // 如果是从结果链接进入的，返回首页
                  if (resultId) {
                    handleBackToHome();
                  } else {
                    setStep('playlist');
                  }
                }}
                onSelectSong={setSelectedSong}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {selectedSong && <SongModal match={selectedSong} onClose={() => setSelectedSong(null)} />}
      </AnimatePresence>
      
      {/* 游戏 Logo 滚动条 - 独立于背景，固定在底部 */}
      <GameLogoMarquee />
    </div>
  );
}
