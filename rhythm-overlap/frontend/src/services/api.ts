// 动态 API 地址：使用当前页面的主机名，支持外网访问
const API_BASE = `http://${window.location.hostname}:3002/api`;

// ============== 多平台支持 ==============
export type PlatformType = 'netease' | 'qqmusic' | 'bilibili' | 'text';

export interface ParsedInput {
    platform: PlatformType;
    type: string;
    id?: string;
    songs?: string[];
    query?: string;
    originalUrl?: string;
    resolvedUrl?: string;
    displayName: string;
    icon: string;
    isShortLink?: boolean;
    needsResolve?: boolean;
    error?: string;
}

// 解析用户输入，自动识别平台
export async function parseInput(input: string): Promise<ParsedInput> {
    const response = await fetch(`${API_BASE}/parse-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    
    // 如果是短链接，自动解析
    if (data.needsResolve && data.id) {
        try {
            const resolved = await resolveShortLink(data.platform, data.id);
            if (resolved.success) {
                return {
                    ...data,
                    id: resolved.id,
                    type: resolved.type,
                    resolvedUrl: resolved.resolvedUrl,
                    needsResolve: false
                };
            } else if (resolved.error) {
                // 返回错误信息
                return {
                    ...data,
                    error: resolved.error,
                    needsResolve: false
                };
            }
        } catch (e) {
            console.warn('短链接解析失败:', e);
            // 返回原始结果，让用户知道可能需要手动输入
        }
    }
    
    return data;
}

// 解析短链接
export async function resolveShortLink(platform: string, shortId: string): Promise<{
    success: boolean;
    type?: string;
    id?: string;
    resolvedUrl?: string;
    message?: string;
    error?: string;
}> {
    const endpoint = platform === 'netease' ? 'netease' : 'qqmusic';
    const response = await fetch(`${API_BASE}/resolve/${endpoint}/${shortId}`);
    return response.json();
}

// 通用歌单接口
export interface UserPlaylist {
    id: number | string;
    name: string;
    coverUrl: string;
    trackCount: number;
    playCount?: number;
    creator: string;
}

// ============== 网易云音乐 API ==============
export async function getNeteaseUserPlaylists(uid: string): Promise<{ success: boolean; playlists: UserPlaylist[]; error?: string }> {
    const response = await fetch(`${API_BASE}/netease/user/${uid}/playlists`);
    const data = await response.json();
    if (!data.success) {
        return { success: false, playlists: [], error: data.error };
    }
    return { success: true, playlists: data.playlists };
}

export async function getNeteasePlaylistSongs(playlistId: string) {
    const response = await fetch(`${API_BASE}/netease/playlist/${playlistId}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return { songs: data.songs, total: data.total };
}

// 兼容旧接口
export const getUserPlaylists = getNeteaseUserPlaylists;
export const getPlaylistSongs = getNeteasePlaylistSongs;

// ============== QQ音乐 API ==============
export async function getQQMusicPlaylist(playlistId: string) {
    const response = await fetch(`${API_BASE}/qqmusic/playlist/${playlistId}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return { 
        playlist: data.playlist,
        songs: data.songs, 
        total: data.total 
    };
}

// ============== Bilibili API ==============
export async function getBilibiliUserFavlist(uid: string): Promise<{ success: boolean; playlists: UserPlaylist[]; error?: string }> {
    const response = await fetch(`${API_BASE}/bilibili/user/${uid}/favlist`);
    const data = await response.json();
    if (!data.success) {
        return { success: false, playlists: [], error: data.error };
    }
    return { success: true, playlists: data.playlists };
}

export async function getBilibiliFavlistSongs(favlistId: string) {
    const response = await fetch(`${API_BASE}/bilibili/favlist/${favlistId}/all`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return { songs: data.songs, total: data.total };
}

// ============== 文本解析 API ==============
export async function parseTextSongs(text: string) {
    const response = await fetch(`${API_BASE}/text/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return { songs: data.songs, total: data.total };
}

// ============== 统一获取函数 ==============
export async function getPlaylistsByPlatform(platform: PlatformType, id: string): Promise<{ success: boolean; playlists: UserPlaylist[]; error?: string }> {
    switch (platform) {
        case 'netease':
            return getNeteaseUserPlaylists(id);
        case 'bilibili':
            return getBilibiliUserFavlist(id);
        case 'qqmusic':
            // QQ音乐直接获取歌单，不需要用户列表
            try {
                const result = await getQQMusicPlaylist(id);
                return { 
                    success: true, 
                    playlists: [{
                        id: result.playlist.id,
                        name: result.playlist.name,
                        coverUrl: result.playlist.coverUrl,
                        trackCount: result.total,
                        creator: result.playlist.creator
                    }]
                };
            } catch (e) {
                return { success: false, playlists: [], error: (e as Error).message };
            }
        default:
            return { success: false, playlists: [], error: '不支持的平台' };
    }
}

export async function getSongsByPlatform(platform: PlatformType, playlistId: string) {
    switch (platform) {
        case 'netease':
            return getNeteasePlaylistSongs(playlistId);
        case 'qqmusic':
            const qqResult = await getQQMusicPlaylist(playlistId);
            return { songs: qqResult.songs, total: qqResult.total };
        case 'bilibili':
            return getBilibiliFavlistSongs(playlistId);
        default:
            throw new Error('不支持的平台');
    }
}

// 游戏配置 API
export interface GameConfig {
    id: string;
    name: string;
    shortName: string;
    color: string;
}

export async function getGames(): Promise<GameConfig[]> {
    const response = await fetch(`${API_BASE}/games`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.games;
}

// 匹配 API
export interface UserSong {
    id: number;
    name: string;
    artists: string;
    album: string;
    coverUrl: string;
    duration?: number;
}

export interface ChartInfo {
    difficulty: string;
    level: string | number;
    ds?: number;
    notes?: number;
}

export interface ArcadeSong {
    id: string;
    title: string;
    artist: string;
    category: string;
    version: string;
    coverUrl: string | null;
    bpm?: number | string | { min?: number; max?: number };
    // 可选的扩展字段（后端可能返回）
    charts?: ChartInfo[];
    levels?: (string | number)[];
    ds?: number[];
    gameId?: string;
    type?: string; // e.g., 'DX' | 'STD'
}

// 匹配标签类型
export type MatchTag = 
    | 'perfect_match'     // 完美匹配（标题+艺术家都高度匹配）
    | 'same_artist'       // 同歌手
    | 'similar_artist'    // 相似歌手
    | 'different_artist'  // 可能翻唱/游戏版本
    | 'exact_title'       // 标题完全匹配
    | 'similar_title';    // 标题相似

export interface MatchItem {
    userSong: UserSong;
    arcadeSong: ArcadeSong;
    score: number;
    matchType: 'exact' | 'fuzzy';
    tags?: MatchTag[];      // 匹配标签
    artistScore?: number;   // 艺术家匹配分数
    titleScore?: number;    // 标题匹配分数
}

export interface GameMatchResult {
    config: {
        name: string;
        shortName: string;
        color: string;
    };
    stats: {
        totalUserSongs: number;
        totalArcadeSongs: number;
        matchedCount: number;
        overlapPercentage: number;
    } | null;
    matches: MatchItem[];
    error?: string;
}

export interface MatchAllResult {
    totalUserSongs: number;
    elapsed: number;
    results: Record<string, GameMatchResult>;
}

// SSE 匹配接口
export interface MatchMetadata {
    neteaseUid: string;
    playlistId: string;
    playlistName: string;
}

// 收集客户端信息（类似 Google Analytics）
function getClientInfo() {
    const nav = navigator as any;
    return {
        // 屏幕尺寸
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        screenColorDepth: window.screen.colorDepth,
        // 视口尺寸
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        // 设备像素比
        devicePixelRatio: window.devicePixelRatio || 1,
        // 语言和时区
        language: navigator.language,
        languages: navigator.languages?.join(',') || navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        // 设备类型
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        // 触摸支持
        touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0,
        maxTouchPoints: nav.maxTouchPoints || 0,
        // 内存（如果可用）
        deviceMemory: nav.deviceMemory || null,
        hardwareConcurrency: nav.hardwareConcurrency || null,
        // 连接类型
        connectionType: nav.connection?.effectiveType || null,
        // 引荐来源
        referrer: document.referrer || null
    };
}

export async function startMatchStream(userSongs: UserSong[], metadata?: MatchMetadata): Promise<string> {
    const clientInfo = getClientInfo();

    const response = await fetch(`${API_BASE}/match/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userSongs,
            neteaseUid: metadata?.neteaseUid,
            playlistId: metadata?.playlistId,
            playlistName: metadata?.playlistName,
            clientInfo
        })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.sessionId;
}

export function getMatchStreamUrl(sessionId: string): string {
    return `${API_BASE}/match/stream/${sessionId}`;
}

// 试听 API
export interface SongUrlResult {
    url: string | null;
    br: number;
    size: number;
    type: string;
}

export async function getSongUrl(songId: number): Promise<SongUrlResult | null> {
    try {
        const response = await fetch(`${API_BASE}/netease/song/${songId}/url`);
        const data = await response.json();
        if (data.success && data.url) {
            return {
                url: data.url,
                br: data.br,
                size: data.size,
                type: data.type
            };
        }
        return null;
    } catch {
        return null;
    }
}
