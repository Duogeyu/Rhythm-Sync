const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fuzzysort = require('fuzzysort');
const fs = require('fs');
const path = require('path');
const {
    user_playlist,
    playlist_detail,
    playlist_track_all,
    song_detail,
    song_url
} = require('NeteaseCloudMusicApi');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============== 临时密码保护 ==============
const TEMP_PASSWORD = '114514';

app.post('/api/auth/verify', (req, res) => {
    const { password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[AUTH] ${new Date().toISOString()} - IP: ${clientIp} - 密码验证尝试`);
    if (password === TEMP_PASSWORD) {
        console.log(`[AUTH] ✓ 验证成功 - IP: ${clientIp}`);
        res.json({ success: true });
    } else {
        console.log(`[AUTH] ✗ 密码错误 - IP: ${clientIp}`);
        res.status(401).json({ success: false, error: '密码错误' });
    }
});

// ============== 日志系统 ==============
const LOG_DIR = path.join(__dirname, '.logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 获取客户端 IP
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress ||
        'unknown';
}

// 请求日志中间件
app.use((req, res, next) => {
    const clientIp = getClientIp(req);
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl || req.url;

    console.log(`[REQUEST] ${timestamp} | ${clientIp} | ${method} ${url}`);

    // 记录响应时间
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[RESPONSE] ${timestamp} | ${clientIp} | ${method} ${url} | ${res.statusCode} | ${duration}ms`);
    });

    next();
});

// 保存查询日志
function saveQueryLog(logData) {
    const { sessionId, clientIp, neteaseUid, playlistId, playlistName, songCount, matchResults, startTime, endTime } = logData;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `query_${neteaseUid}_${playlistId}_${timestamp}.json`;
    const filepath = path.join(LOG_DIR, filename);

    const logEntry = {
        sessionId,
        clientIp,
        neteaseUid,
        playlistId,
        playlistName,
        songCount,
        matchResults: Object.fromEntries(
            Object.entries(matchResults || {}).map(([gameId, result]) => [
                gameId,
                { matchCount: result.matches?.length || 0 }
            ])
        ),
        startTime,
        endTime,
        duration: endTime - startTime,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(filepath, JSON.stringify(logEntry, null, 2), 'utf-8');
    console.log(`[LOG] 查询日志已保存: ${filename}`);

    return filename;
}

// ============== 缓存配置 ==============
const CACHE_DIR = path.join(__dirname, '.cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 游戏配置 - 完整版本（含国服）
const GAME_CONFIG = {
    'maimai': {
        name: 'maimai DX (国际)',
        shortName: 'maimai 国际',
        color: '#FFD700',
        sources: ['https://www.diving-fish.com/api/maimaidxprober/music_data'],
        normalize: 'diving-fish-maimai'
    },
    'maimai-cn': {
        name: 'maimai DX (国服)',
        shortName: 'maimai 国服',
        color: '#FF8C00',
        // 使用 jsDelivr CDN 加速 GitHub 访问
        sources: [
            'https://cdn.jsdelivr.net/gh/CrazyKidCN/maimaiDX-CN-songs-database@main/maidata.json',
            'https://raw.githubusercontent.com/CrazyKidCN/maimaiDX-CN-songs-database/main/maidata.json'
        ],
        normalize: 'maimai-cn'
    },
    'chunithm': {
        name: 'CHUNITHM',
        shortName: 'CHUNITHM',
        color: '#00CED1',
        sources: ['https://www.diving-fish.com/api/chunithmprober/music_data'],
        normalize: 'diving-fish-chunithm'
    },
    'ongeki': {
        name: 'ONGEKI',
        shortName: 'ONGEKI',
        color: '#9932CC',
        sources: ['https://reiwa.f5.si/ongeki_all.json'],
        normalize: 'reiwa'
    },
    'taiko': {
        name: '太鼓の達人',
        shortName: '太鼓',
        color: '#FF6347',
        // 使用 jsDelivr CDN 加速 GitHub 访问
        sources: [
            'https://cdn.jsdelivr.net/gh/taikowiki/taiko-song-database@main/database.json',
            'https://raw.githubusercontent.com/taikowiki/taiko-song-database/main/database.json'
        ],
        normalize: 'taiko'
    }
};

// ============== 缓存函数 ==============
function getCacheFilePath(gameId) {
    return path.join(CACHE_DIR, `${gameId}.json`);
}

function readCache(gameId) {
    const filePath = getCacheFilePath(gameId);
    if (!fs.existsSync(filePath)) return null;

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Date.now() - data.timestamp < CACHE_DURATION) {
            console.log(`[缓存] ${gameId} 命中缓存 (${data.songs.length}首)`);
            return data.songs;
        }
        console.log(`[缓存] ${gameId} 缓存过期`);
        return null;
    } catch (e) {
        return null;
    }
}

function writeCache(gameId, songs) {
    const filePath = getCacheFilePath(gameId);
    fs.writeFileSync(filePath, JSON.stringify({
        timestamp: Date.now(),
        songs
    }));
    console.log(`[缓存] ${gameId} 已写入缓存 (${songs.length}首)`);
}

// ============== 数据获取和标准化 ==============
function normalizeSongs(data, type, gameId) {
    if (type === 'diving-fish-maimai') {
        return data.map(s => ({
            id: String(s.id),
            title: s.title,
            artist: s.basic_info?.artist || '',
            category: s.basic_info?.genre || '',
            version: s.basic_info?.from || '',
            bpm: s.basic_info?.bpm || 0,
            coverUrl: `https://www.diving-fish.com/covers/${String(s.id).padStart(5, '0')}.png`,
            // 额外信息
            type: s.type || 'SD', // SD or DX
            isNew: s.basic_info?.is_new || false,
            levels: s.level || [], // ["5", "7", "10", "12", "12+"]
            ds: s.ds || [], // [5.0, 7.2, 10.2, 12.4, 13.0] 定数
            charts: s.charts?.map((c, i) => ({
                difficulty: ['Basic', 'Advanced', 'Expert', 'Master', 'Re:Master'][i] || `Lv${i}`,
                level: s.level?.[i] || '?',
                ds: s.ds?.[i] || 0,
                charter: c.charter || '-',
                notes: c.notes || []
            })) || []
        }));
    } else if (type === 'diving-fish-chunithm') {
        // CHUNITHM 封面使用 Lxns 提供的封面服务
        return data.map(s => ({
            id: String(s.id),
            title: s.title,
            artist: s.basic_info?.artist || '',
            category: s.basic_info?.genre || '',
            version: s.basic_info?.from || '',
            bpm: s.basic_info?.bpm || 0,
            coverUrl: `https://lxns.net/chunithm/jacket/${s.id}.png`,
            // 额外信息
            levels: s.level || [],
            ds: s.ds || [],
            charts: s.charts?.map((c, i) => ({
                difficulty: ['Basic', 'Advanced', 'Expert', 'Master', 'Ultima'][i] || `Lv${i}`,
                level: s.level?.[i] || '?',
                ds: s.ds?.[i] || 0,
                charter: c.charter || '-',
                combo: c.combo || 0
            })) || []
        }));
    } else if (type === 'reiwa') {
        // ONGEKI 数据 from reiwa.f5.si
        return data.map(s => {
            const id = s.meta?.id || String(Math.random());
            const imgHash = s.meta?.img;
            const coverUrl = imgHash 
                ? `https://ongeki-net.com/ongeki-mobile/img/music/${imgHash}.png`
                : null;
            // 处理难度数据
            const diffKeys = ['BAS', 'ADV', 'EXP', 'MAS', 'LUN'];
            const diffNames = ['Basic', 'Advanced', 'Expert', 'Master', 'Lunatic'];
            const charts = diffKeys.map((key, i) => {
                const d = s.data?.[key];
                return d ? {
                    difficulty: diffNames[i],
                    level: d.level?.toString() || '?',
                    ds: d.const || d.level || 0
                } : null;
            }).filter(Boolean);
            
            return {
                id,
                title: s.meta?.title || '',
                artist: s.meta?.artist || '',
                category: s.meta?.genre || '',
                version: s.meta?.release || '',
                bpm: s.meta?.bpm || 0,
                coverUrl,
                levels: charts.map(c => c.level),
                ds: charts.map(c => c.ds),
                charts
            };
        });
    } else if (type === 'maimai-cn') {
        // 国服数据格式 from CrazyKidCN/maimaiDX-CN-songs-database
        return data.map(s => ({
            id: s.image_file || String(Math.random()),
            title: s.title || '',
            artist: s.artist || '',
            category: s.category || '',
            version: s.version || '',
            bpm: s.bpm || 0,
            coverUrl: s.image_file
                ? `https://maimai.wahlap.com/maimai-mobile/img/Music/${s.image_file}`
                : null,
            type: s.type || 'SD',
            levels: s.level || [],
            ds: s.ds || []
        }));
    } else if (type === 'taiko') {
        // 太鼓达人数据格式 from taikowiki/taiko-song-database
        return data.map(s => {
            const coverUrl = s.image?.url 
                || s.jacket 
                || s.coverUrl 
                || (s.songNo ? `https://taiko.namco-ch.net/taiko/images/songimage/${s.songNo}.png` : null);
            // 太鼓难度
            const diffNames = ['かんたん', 'ふつう', 'むずかしい', 'おに', '裏おに'];
            const charts = [];
            if (s.courses) {
                Object.entries(s.courses).forEach(([key, val]) => {
                    if (val && typeof val === 'object') {
                        charts.push({
                            difficulty: diffNames[parseInt(key)] || key,
                            level: val.level?.toString() || '?',
                            ds: val.level || 0
                        });
                    }
                });
            }
            return {
                id: s.songNo || String(Math.random()),
                title: s.title || '',
                artist: s.artist || '',
                category: s.genre || '',
                version: s.version || '',
                bpm: s.bpm || 0,
                coverUrl,
                levels: charts.map(c => c.level),
                ds: charts.map(c => c.ds),
                charts
            };
        });
    }
    return data;
}

async function fetchGameSongs(gameId) {
    // 先检查缓存
    const cached = readCache(gameId);
    if (cached) return cached;

    const config = GAME_CONFIG[gameId];
    if (!config) throw new Error(`未知游戏: ${gameId}`);

    for (const url of config.sources) {
        try {
            console.log(`[获取] ${gameId}: ${url}`);
            // 减少超时时间到 10 秒，避免卡住太久
            const response = await axios.get(url, { 
                timeout: 10000,
                // 添加 headers 避免某些服务器拒绝请求
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const songs = normalizeSongs(response.data, config.normalize, gameId);
            console.log(`[获取] ${gameId}: 成功 (${songs.length}首)`);

            // 写入缓存
            writeCache(gameId, songs);
            return songs;
        } catch (error) {
            console.error(`[获取] ${gameId} 失败:`, error.message);
        }
    }
    // 如果所有源都失败，返回空数组而不是抛出错误，避免阻塞其他游戏
    console.warn(`[获取] ${gameId}: 所有数据源均失败，返回空数据`);
    return [];
}

// ============== 网易云音乐 API ==============
app.get('/api/netease/user/:uid/playlists', async (req, res) => {
    try {
        const { uid } = req.params;
        const result = await user_playlist({ uid, limit: 100 });

        if (result.body.code === 200) {
            const playlists = result.body.playlist.map(p => ({
                id: p.id,
                name: p.name,
                coverUrl: p.coverImgUrl,
                trackCount: p.trackCount,
                playCount: p.playCount,
                creator: p.creator?.nickname
            }));
            res.json({ success: true, playlists });
        } else {
            res.status(400).json({ success: false, error: '获取歌单失败' });
        }
    } catch (error) {
        console.error('获取用户歌单错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/netease/playlist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[歌单] 正在获取歌单详情: ${id}`);

        // 首先获取歌单基本信息和 trackIds
        const detailResult = await playlist_detail({ id });
        if (detailResult.body.code !== 200) {
            console.error('[歌单] 获取歌单详情失败:', detailResult.body);
            return res.status(400).json({ success: false, error: '获取歌单详情失败' });
        }

        const trackIds = detailResult.body.playlist.trackIds || [];
        console.log(`[歌单] 歌单共有 ${trackIds.length} 首歌曲`);

        // 分批获取歌曲详情（每批 500 首）
        const BATCH_SIZE = 500;
        const promises = [];

        for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
            const batch = trackIds.slice(i, i + BATCH_SIZE);
            const ids = batch.map(t => t.id).join(',');

            promises.push(
                song_detail({ ids })
                    .then(res => {
                        if (res.body.songs) {
                            return res.body.songs.map(s => ({
                                id: s.id,
                                name: s.name,
                                artists: s.ar?.map(a => a.name).join(', ') || '',
                                album: s.al?.name || '',
                                coverUrl: s.al?.picUrl || '',
                                duration: s.dt
                            }));
                        }
                        return [];
                    })
                    .catch(err => {
                        console.error(`[歌单] 获取第 ${i / BATCH_SIZE + 1} 批歌曲失败:`, err.message);
                        return [];
                    })
            );
        }

        const results = await Promise.all(promises);
        const allSongs = results.flat();

        console.log(`[歌单] 成功获取 ${allSongs.length} 首歌曲`);
        res.json({ success: true, songs: allSongs, total: allSongs.length });
    } catch (error) {
        console.error('获取歌单详情错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== 游戏配置 API ==============
app.get('/api/games', (req, res) => {
    const games = Object.entries(GAME_CONFIG).map(([id, config]) => ({
        id,
        name: config.name,
        shortName: config.shortName,
        color: config.color
    }));
    res.json({ success: true, games });
});

// ============== 歌曲试听 API ==============
app.get('/api/netease/song/:id/url', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await song_url({ id, br: 320000 }); // 320kbps

        if (result.body.code === 200 && result.body.data && result.body.data.length > 0) {
            const urlData = result.body.data[0];
            res.json({
                success: true,
                url: urlData.url,
                br: urlData.br,
                size: urlData.size,
                type: urlData.type
            });
        } else {
            res.json({ success: false, error: '无法获取试听链接（可能需要 VIP）' });
        }
    } catch (error) {
        console.error('获取试听链接错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 内存存储匹配任务
const activeJobs = new Map();

// 启动匹配任务
app.post('/api/match/start', (req, res) => {
    const { userSongs, neteaseUid, playlistId, playlistName } = req.body;
    const clientIp = getClientIp(req);

    if (!userSongs || !Array.isArray(userSongs)) {
        return res.status(400).json({ success: false, error: '缺少用户歌曲数据' });
    }

    // 生成简单 Session ID
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    // 存储任务信息（包含元数据）
    activeJobs.set(sessionId, {
        userSongs,
        metadata: {
            neteaseUid: neteaseUid || 'unknown',
            playlistId: playlistId || 'unknown',
            playlistName: playlistName || 'unknown',
            clientIp,
            startTime: Date.now()
        }
    });

    console.log(`[MATCH] 新匹配任务 - Session: ${sessionId} | IP: ${clientIp} | UID: ${neteaseUid} | 歌单: ${playlistName} (${userSongs.length}首)`);

    // 10分钟后自动清理，防止内存泄漏
    setTimeout(() => activeJobs.delete(sessionId), 600000);

    res.json({ success: true, sessionId });
});

// SSE 流式输出接口
app.get('/api/match/stream/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const jobData = activeJobs.get(sessionId);

    if (!jobData) {
        return res.status(404).json({ error: 'Session not found or expired' });
    }

    // 提取 userSongs 和 metadata
    const { userSongs, metadata } = jobData;
    const { neteaseUid, playlistId, playlistName, clientIp, startTime } = metadata;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    // 用于收集匹配结果以保存日志
    const matchResultsForLog = {};

    try {
        activeJobs.delete(sessionId); // 取出后即删除（或者保留? 这里一次性消费即可）

        // 1. 准备所有游戏数据
        const gameIds = Object.keys(GAME_CONFIG);
        const gameDataPromises = gameIds.map(async (gameId) => {
            try {
                const songs = await fetchGameSongs(gameId);
                return { gameId, songs, error: null };
            } catch (error) {
                return { gameId, songs: [], error: error.message };
            }
        });

        const gameDataResults = await Promise.all(gameDataPromises);

        // 发送初始化配置信息
        const gameStats = {};
        gameDataResults.forEach(({ gameId, songs, error }) => {
            gameStats[gameId] = {
                config: GAME_CONFIG[gameId],
                totalArcadeSongs: songs.length,
                error
            };
        });
        sendEvent('init', { totalUserSongs: userSongs.length, gameStats });

        // 2. 准备匹配索引
        const normalizeTitle = (str) => {
            if (!str) return '';
            return str.toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[！!]/g, '!')
                .replace(/[？?]/g, '?')
                .replace(/[（(]/g, '(')
                .replace(/[）)]/g, ')')
                .replace(/[－-]/g, '-');
        };

        const matchers = gameDataResults.map(({ gameId, songs, error }) => {
            if (error) return null;

            const titleMap = new Map();
            songs.forEach(s => {
                titleMap.set(normalizeTitle(s.title), s);
            });

            // fuzzysort 预处理标题以加速搜索
            const preparedSongs = songs.map(s => ({
                ...s,
                preparedTitle: fuzzysort.prepare(s.title || '')
            }));

            return { gameId, titleMap, preparedSongs };
        });

        // 3. 逐个匹配歌曲并推送
        let processedCount = 0;

        // 批量处理，避免每首发送一次导致通信开销太大，每 5 首发一次
        const BATCH_SIZE = 5;
        let batchResults = [];

        // 辅助函数：计算艺术家相似度
        const normalizeArtist = (str) => {
            if (!str) return '';
            return str.toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[,，、&＆]/g, '') // 去除分隔符
                .replace(/feat\.?/gi, '')
                .replace(/cv[.:]?/gi, '')
                .replace(/[(（][^)）]*[)）]/g, ''); // 去除括号内容
        };

        const artistMatch = (userArtist, gameArtist) => {
            const ua = normalizeArtist(userArtist);
            const ga = normalizeArtist(gameArtist);
            if (!ua || !ga) return 0.5; // 无法判断时给中等分数
            if (ua === ga) return 1.0;
            if (ua.includes(ga) || ga.includes(ua)) return 0.8;
            // 检查是否有共同的艺术家名片段（至少3个字符）
            const uaParts = ua.split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(p => p.length >= 3);
            const gaParts = ga.split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(p => p.length >= 3);
            for (const up of uaParts) {
                for (const gp of gaParts) {
                    if (up.includes(gp) || gp.includes(up)) return 0.6;
                }
            }
            return 0.2;
        };

        for (const userSong of userSongs) {
            const songMatches = {};
            const normalizedName = normalizeTitle(userSong.name);

            matchers.forEach(matcher => {
                if (!matcher) return; // Skip failed games

                const { gameId, titleMap, preparedSongs } = matcher;
                let match = null;

                // 精确匹配
                if (titleMap.has(normalizedName)) {
                    const arcadeSong = titleMap.get(normalizedName);
                    const artistScore = artistMatch(userSong.artists, arcadeSong.artist);
                    // 精确匹配标题，综合艺术家相似度
                    const finalScore = 0.8 + (artistScore * 0.2);
                    match = {
                        userSong,
                        arcadeSong,
                        score: finalScore,
                        matchType: artistScore >= 0.5 ? 'exact' : 'fuzzy'
                    };
                }
                // 模糊匹配 (使用 fuzzysort)
                else {
                    const results = fuzzysort.go(userSong.name, preparedSongs, {
                        key: 'preparedTitle',
                        limit: 3, // 取前3个结果进行艺术家比对
                        threshold: -3000 // 提高阈值，只接受较好的匹配 (原为 -10000)
                    });

                    // 从候选结果中选择最佳匹配（结合标题分数和艺术家分数）
                    let bestMatch = null;
                    let bestScore = 0;

                    for (const result of results) {
                        if (result.score < -2500) continue; // 跳过太差的匹配
                        
                        const titleScore = Math.max(0, (result.score + 3000) / 3000); // 转换为 0-1
                        const artistScore = artistMatch(userSong.artists, result.obj.artist);
                        
                        // 综合分数：标题占 70%，艺术家占 30%
                        const combinedScore = (titleScore * 0.7) + (artistScore * 0.3);
                        
                        // 只接受综合分数 >= 0.6 的匹配 (60% 相似度)
                        if (combinedScore >= 0.6 && combinedScore > bestScore) {
                            bestScore = combinedScore;
                            bestMatch = {
                                userSong,
                                arcadeSong: result.obj,
                                score: combinedScore,
                                matchType: combinedScore >= 0.85 ? 'exact' : 'fuzzy'
                            };
                        }
                    }

                    match = bestMatch;
                }

                if (match) {
                    songMatches[gameId] = match;
                }
            });

            if (Object.keys(songMatches).length > 0) {
                batchResults.push({ userSong, matches: songMatches });
            }

            processedCount++;

            // 批量推送或最后推送
            if (batchResults.length >= BATCH_SIZE || processedCount === userSongs.length) {
                if (batchResults.length > 0) {
                    // 收集匹配结果用于日志
                    batchResults.forEach(({ matches }) => {
                        Object.entries(matches).forEach(([gameId, match]) => {
                            if (!matchResultsForLog[gameId]) {
                                matchResultsForLog[gameId] = { matches: [] };
                            }
                            matchResultsForLog[gameId].matches.push(match);
                        });
                    });

                    sendEvent('batch_match', batchResults);
                    batchResults = [];
                }
                // 发送进度更新
                sendEvent('progress', { processed: processedCount, total: userSongs.length });
            }
        }

        // 保存查询日志
        const endTime = Date.now();
        saveQueryLog({
            sessionId,
            clientIp,
            neteaseUid,
            playlistId,
            playlistName,
            songCount: userSongs.length,
            matchResults: matchResultsForLog,
            startTime,
            endTime
        });

        sendEvent('done', {});
        res.end();

    } catch (error) {
        console.error('Stream Error:', error);
        sendEvent('error', { message: error.message });
        res.end();
    }
});

// ============== 多游戏并行匹配 API ==============
app.post('/api/match-all', async (req, res) => {
    try {
        const { userSongs } = req.body;

        if (!userSongs || !Array.isArray(userSongs)) {
            return res.status(400).json({ success: false, error: '缺少用户歌曲数据' });
        }

        console.log(`\n[匹配] 开始匹配 ${userSongs.length} 首歌曲...`);
        const startTime = Date.now();

        // 并行获取所有游戏数据
        const gameIds = Object.keys(GAME_CONFIG);
        const gameDataPromises = gameIds.map(async (gameId) => {
            try {
                const songs = await fetchGameSongs(gameId);
                return { gameId, songs, error: null };
            } catch (error) {
                return { gameId, songs: [], error: error.message };
            }
        });

        const gameDataResults = await Promise.all(gameDataPromises);

        // 辅助函数：标准化标题用于精确匹配
        const normalizeTitle = (str) => {
            if (!str) return '';
            return str.toLowerCase()
                .replace(/\s+/g, '') // 去除空格
                .replace(/[！!]/g, '!')
                .replace(/[？?]/g, '?')
                .replace(/[（(]/g, '(')
                .replace(/[）)]/g, ')')
                .replace(/[－-]/g, '-');
        };

        // 对每个游戏进行匹配（并行处理）
        const matchPromises = gameDataResults.map(async ({ gameId, songs, error }) => {
            if (error) {
                return {
                    [gameId]: {
                        error,
                        config: GAME_CONFIG[gameId],
                        stats: null,
                        matches: []
                    }
                };
            }

            // 1. 建立精确匹配索引 (Map)
            const titleMap = new Map();
            songs.forEach(s => {
                titleMap.set(normalizeTitle(s.title), s);
                // 尝试保留原始标题作为 key 备用
                titleMap.set(s.title, s);
            });

            // 2. 建立 Fuse.js 模糊匹配索引
            const fuse = new Fuse(songs, {
                keys: ['title', 'artist'],
                threshold: 0.3,
                includeScore: true
            });

            const matches = [];
            const matchedUserSongIds = new Set();

            for (const userSong of userSongs) {
                // 优化：先尝试精确匹配
                const normalizedParams = normalizeTitle(userSong.name);

                if (titleMap.has(normalizedParams)) {
                    matches.push({
                        userSong,
                        arcadeSong: titleMap.get(normalizedParams),
                        score: 1.0,
                        matchType: 'exact'
                    });
                    matchedUserSongIds.add(userSong.id);
                    continue; // 命中精确匹配，跳过 Fuse
                }

                // 未命中，使用 Fuse 模糊匹配
                const fuseResults = fuse.search(userSong.name);

                if (fuseResults.length > 0 && fuseResults[0].score < 0.3) {
                    matches.push({
                        userSong,
                        arcadeSong: fuseResults[0].item,
                        score: 1 - fuseResults[0].score,
                        matchType: fuseResults[0].score < 0.1 ? 'exact' : 'fuzzy'
                    });
                    matchedUserSongIds.add(userSong.id);
                }
            }

            const stats = {
                totalUserSongs: userSongs.length,
                totalArcadeSongs: songs.length,
                matchedCount: matches.length,
                overlapPercentage: Math.round((matches.length / userSongs.length) * 100)
            };

            return {
                [gameId]: {
                    config: GAME_CONFIG[gameId],
                    stats,
                    matches: matches.sort((a, b) => b.score - a.score)
                }
            };
        });

        const matchResults = await Promise.all(matchPromises);
        const results = Object.assign({}, ...matchResults);

        const elapsed = Date.now() - startTime;
        console.log(`[匹配] 完成，耗时 ${elapsed}ms`);

        res.json({
            success: true,
            totalUserSongs: userSongs.length,
            elapsed,
            results
        });
    } catch (error) {
        console.error('匹配错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🎮 音游歌单匹配服务运行在 http://localhost:${PORT}`);
    console.log(`📁 缓存目录: ${CACHE_DIR}`);
    console.log(`⏱️  缓存有效期: 24小时`);
});
