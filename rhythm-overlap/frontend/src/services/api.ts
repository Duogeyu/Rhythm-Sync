// 动态 API 地址：使用当前页面的主机名，支持外网访问
const API_BASE = `http://${window.location.hostname}:3002/api`;

// 网易云音乐 API
export interface UserPlaylist {
    id: number;
    name: string;
    coverUrl: string;
    trackCount: number;
    playCount: number;
    creator: string;
}

export async function getUserPlaylists(uid: string): Promise<{ success: boolean; playlists: UserPlaylist[]; error?: string }> {
    const response = await fetch(`${API_BASE}/netease/user/${uid}/playlists`);
    const data = await response.json();
    if (!data.success) {
        return { success: false, playlists: [], error: data.error };
    }
    return { success: true, playlists: data.playlists };
}

export async function getPlaylistSongs(playlistId: string) {
    const response = await fetch(`${API_BASE}/netease/playlist/${playlistId}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return { songs: data.songs, total: data.total };
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

export interface ArcadeSong {
    id: string;
    title: string;
    artist: string;
    category: string;
    version: string;
    coverUrl: string | null;
    bpm?: number;
}

export interface MatchItem {
    userSong: UserSong;
    arcadeSong: ArcadeSong;
    score: number;
    matchType: 'exact' | 'fuzzy';
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

export async function startMatchStream(userSongs: UserSong[], metadata?: MatchMetadata): Promise<string> {
    const response = await fetch(`${API_BASE}/match/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userSongs,
            neteaseUid: metadata?.neteaseUid,
            playlistId: metadata?.playlistId,
            playlistName: metadata?.playlistName
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
