const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fuzzysort = require('fuzzysort');
const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const QRCode = require('qrcode');
const {
    user_playlist,
    playlist_detail,
    playlist_track_all,
    song_detail,
    song_url,
    song_chorus,
    cloudsearch
} = require('NeteaseCloudMusicApi');

// ============== 安全过滤函数 ==============
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // 限制输入长度（防止 DoS）
    const maxLength = 10000;
    let sanitized = input.slice(0, maxLength);
    
    // 移除危险字符和潜在的脚本注入
    sanitized = sanitized
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '') // 移除 script 标签
        .replace(/<[^>]*>/g, '') // 移除所有 HTML 标签
        .replace(/javascript:/gi, '') // 移除 javascript: 协议
        .replace(/on\w+\s*=/gi, '') // 移除事件处理器
        .replace(/data:/gi, '') // 移除 data: 协议
        .replace(/vbscript:/gi, '') // 移除 vbscript: 协议
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // 移除控制字符
    
    return sanitized.trim();
}

// 从混合文本中提取 URL
function extractUrlFromText(text) {
    // 匹配常见 URL 格式
    const urlPattern = /https?:\/\/[^\s<>"'()（）\[\]【】]+/gi;
    const matches = text.match(urlPattern);
    return matches ? matches[0] : null;
}

function getPublicWebBaseUrl(req) {
    const envUrl = (process.env.PUBLIC_WEB_URL || '').trim();
    if (envUrl) {
        return envUrl.replace(/\/+$/, '');
    }

    if (req) {
        const forwardedProto = req.headers['x-forwarded-proto'];
        const protocol = forwardedProto ? String(forwardedProto).split(',')[0].trim() : (req.protocol || 'http');
        const host = req.get('host') || 'localhost:3002';
        return `${protocol}://${host.replace(':3002', ':5173')}`.replace(/\/+$/, '');
    }

    return 'http://localhost:5173';
}

// ============== 多平台链接解析器 ==============
const PLATFORM_PATTERNS = {
    // 网易云音乐
    netease: {
        name: '网易云音乐',
        icon: 'netease',
        patterns: [
            // 完整链接
            /music\.163\.com.*[?&]id=(\d+)/,
            /music\.163\.com\/playlist\/(\d+)/,
            /music\.163\.com\/#\/playlist\?id=(\d+)/,
            /music\.163\.com.*user\/home\?id=(\d+)/,
            /music\.163\.com\/#\/user\/home\?id=(\d+)/,
            // 短链接 (需要跳转解析)
            /163cn\.tv\/([a-zA-Z0-9]+)/,
        ],
        extractType: (url) => {
            if (url.includes('playlist') || url.includes('163cn.tv')) return 'playlist';
            if (url.includes('user')) return 'user';
            return 'playlist'; // 短链接默认为歌单
        },
        // 短链接需要特殊处理
        isShortLink: (url) => url.includes('163cn.tv')
    },
    // QQ音乐
    qqmusic: {
        name: 'QQ音乐',
        icon: 'qqmusic',
        patterns: [
            // 完整链接
            /y\.qq\.com\/n\/ryqq\/playlist\/(\d+)/,
            /y\.qq\.com\/w\/taoge\.html\?id=(\d+)/,
            /i\.y\.qq\.com\/n2\/m\/share\/details\/taoge\.html\?id=(\d+)/,
            // 短链接 (c.y.qq.com 和 c6.y.qq.com)
            /c\.y\.qq\.com\/base\/fcgi-bin\/u\?__=([a-zA-Z0-9]+)/,
            /c6\.y\.qq\.com\/base\/fcgi-bin\/u\?__=([a-zA-Z0-9]+)/,
        ],
        extractType: () => 'playlist',
        // 短链接需要特殊处理
        isShortLink: (url) => url.includes('c.y.qq.com') || url.includes('c6.y.qq.com')
    },
    // Bilibili
    bilibili: {
        name: 'Bilibili',
        icon: 'bilibili',
        patterns: [
            // 完整链接
            /space\.bilibili\.com\/(\d+)\/favlist/,
            /space\.bilibili\.com\/(\d+)/,
            /bilibili\.com\/medialist\/detail\/ml(\d+)/,
            // 短链接
            /b23\.tv\/([a-zA-Z0-9]+)/,
        ],
        extractType: (url) => {
            if (url.includes('favlist') || url.includes('medialist')) return 'favlist';
            return 'user';
        },
        isShortLink: (url) => url.includes('b23.tv')
    }
};

// 解析输入内容，自动识别平台
function parseInput(input) {
    // 1. 安全过滤
    const sanitized = sanitizeInput(input);
    if (!sanitized) {
        return {
            platform: 'text',
            type: 'empty',
            error: '输入内容为空或包含非法字符',
            displayName: '无效输入',
            icon: 'text'
        };
    }
    
    // 2. 纯数字 - 默认网易云用户ID
    if (/^\d{5,15}$/.test(sanitized)) {
        return {
            platform: 'netease',
            type: 'user',
            id: sanitized,
            displayName: '网易云音乐',
            icon: 'netease'
        };
    }
    
    // 3. 尝试从混合文本中提取 URL
    const extractedUrl = extractUrlFromText(sanitized);
    const textToMatch = extractedUrl || sanitized;
    
    // 4. 检测各平台链接
    for (const [platformKey, platform] of Object.entries(PLATFORM_PATTERNS)) {
        for (const pattern of platform.patterns) {
            const match = textToMatch.match(pattern);
            if (match) {
                const isShort = platform.isShortLink ? platform.isShortLink(textToMatch) : false;
                return {
                    platform: platformKey,
                    type: platform.extractType ? platform.extractType(textToMatch, match) : 'unknown',
                    id: match[1],
                    originalUrl: textToMatch,
                    displayName: platform.name,
                    icon: platform.icon,
                    isShortLink: isShort,
                    needsResolve: isShort // 短链接需要解析
                };
            }
        }
    }
    
    // 5. 多行文本 - 当作歌曲列表（过滤掉看起来像 URL 或恶意内容的行）
    if (sanitized.includes('\n') || sanitized.split(/[,，;；]/).length > 2) {
        const lines = sanitized
            .split(/[\n,，;；]/)
            .map(l => l.trim())
            .filter(l => {
                if (!l) return false;
                // 过滤掉 URL
                if (/^https?:\/\//i.test(l)) return false;
                // 过滤掉太短的内容
                if (l.length < 2) return false;
                // 过滤掉看起来像代码的内容
                if (/[{}<>$`\\]/.test(l)) return false;
                return true;
            });
        
        if (lines.length > 0) {
            return {
                platform: 'text',
                type: 'songlist',
                songs: lines,
                displayName: '文本导入',
                icon: 'text'
            };
        }
    }
    
    // 6. 单行文本 - 可能是单首歌（额外安全检查）
    const singleQuery = sanitized.replace(/[@#$%^&*{}[\]\\|<>]/g, '').trim();
    if (singleQuery.length < 2 || singleQuery.length > 200) {
        return {
            platform: 'text',
            type: 'invalid',
            error: '输入内容无效',
            displayName: '无效输入',
            icon: 'text'
        };
    }
    
    return {
        platform: 'text',
        type: 'single',
        query: singleQuery,
        displayName: '文本搜索',
        icon: 'text'
    };
}

const app = express();
const PORT = 3002;

// CORS 配置 - 允许所有来源（包括自定义域名）
app.use(cors({
    origin: true,  // 允许所有来源
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============== 环境变量配置 ==============
const APP_ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD || '';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || '';
const SILICONFLOW_API_URL = process.env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'Pro/deepseek-ai/DeepSeek-V3';

if (!APP_ACCESS_PASSWORD) {
    console.warn('[CONFIG] 未设置 APP_ACCESS_PASSWORD，访问验证接口将允许直接通过');
}

if (!SILICONFLOW_API_KEY) {
    console.warn('[CONFIG] 未设置 SILICONFLOW_API_KEY，AI 锐评将使用本地降级文案');
}

app.post('/api/auth/verify', (req, res) => {
    const { password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[AUTH] ${new Date().toISOString()} - IP: ${clientIp} - 密码验证尝试`);
    if (!APP_ACCESS_PASSWORD || password === APP_ACCESS_PASSWORD) {
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

// IP 归属地缓存（避免重复查询）
const ipLocationCache = new Map();

// 获取客户端 IP
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress ||
        'unknown';
}

// 查询 IP 归属地（使用 ip-api.com 免费服务）
async function getIpLocation(ip) {
    // 处理本地 IP
    if (!ip || ip === 'unknown' || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return { country: '本地', region: '', city: '本地网络', isp: '-' };
    }
    
    // 移除 IPv6 前缀
    const cleanIp = ip.replace(/^::ffff:/, '');
    
    // 检查缓存
    if (ipLocationCache.has(cleanIp)) {
        return ipLocationCache.get(cleanIp);
    }
    
    try {
        const response = await axios.get(`http://ip-api.com/json/${cleanIp}?lang=zh-CN&fields=status,country,regionName,city,isp`, {
            timeout: 3000
        });
        
        if (response.data.status === 'success') {
            const location = {
                country: response.data.country || '未知',
                region: response.data.regionName || '',
                city: response.data.city || '',
                isp: response.data.isp || ''
            };
            // 缓存结果（最多保存 1000 条）
            if (ipLocationCache.size > 1000) {
                const firstKey = ipLocationCache.keys().next().value;
                ipLocationCache.delete(firstKey);
            }
            ipLocationCache.set(cleanIp, location);
            return location;
        }
    } catch (e) {
        console.log(`[IP] 归属地查询失败: ${cleanIp} - ${e.message}`);
    }
    
    return { country: '未知', region: '', city: '', isp: '' };
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
const COVERS_DIR = path.join(__dirname, '.covers');
const CONFIG_FILE = path.join(__dirname, 'config', 'active-sources.json');
const COVERS_CONFIG_FILE = path.join(__dirname, 'config', 'covers.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

// 封面缓存配置
let coversConfig = {
    enabled: true,              // 是否启用封面缓存
    cdnBaseUrl: '',             // CDN 基础 URL（如果配置了，前端会使用 CDN）
    localBaseUrl: '',           // 本地访问 URL（自动生成）
    maxConcurrent: 2,           // 最大并发下载数（降低以避免限流）
    retryCount: 3,              // 下载失败重试次数
    timeout: 30000,             // 下载超时时间(ms)，增加到30秒
    delayBetweenBatches: 500    // 批次之间的延迟(ms)
};

// 加载封面配置
function loadCoversConfig() {
    try {
        if (fs.existsSync(COVERS_CONFIG_FILE)) {
            const loaded = JSON.parse(fs.readFileSync(COVERS_CONFIG_FILE, 'utf-8'));
            coversConfig = { ...coversConfig, ...loaded };
            console.log('[封面] 已加载封面配置');
        }
    } catch (e) {
        console.warn('[封面] 加载配置失败，使用默认配置:', e.message);
    }
}

// 保存封面配置
function saveCoversConfig() {
    try {
        const configDir = path.dirname(COVERS_CONFIG_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(COVERS_CONFIG_FILE, JSON.stringify(coversConfig, null, 2));
    } catch (e) {
        console.error('[封面] 保存配置失败:', e.message);
    }
}

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 确保封面缓存目录存在
if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// 加载封面配置
loadCoversConfig();

// ============== 游戏定义 ==============
// 定义所有支持的游戏及其基本信息
const GAMES = {
    'maimai': { name: 'maimai DX (国际)', shortName: 'maimai 国际', color: '#22d3ee' },
    'maimai-jp': { name: 'maimai DX (日服)', shortName: 'maimai 日服', color: '#06b6d4' },
    'maimai-cn': { name: 'maimai DX (国服)', shortName: 'maimai 国服', color: '#FF8C00' },
    'chunithm': { name: 'CHUNITHM (国际)', shortName: 'CHUNITHM 国际', color: '#facc15' },
    'chunithm-jp': { name: 'CHUNITHM (日服)', shortName: 'CHUNITHM 日服', color: '#fbbf24' },
    'ongeki': { name: 'ONGEKI (日服)', shortName: 'ONGEKI 日服', color: '#e879f9' },
    'taiko': { name: '太鼓の達人', shortName: '太鼓', color: '#FF6347' }
};

// ============== 数据源定义 ==============
// 每个游戏可用的数据源列表，每个数据源有独立的配置
const DATA_SOURCES = {
    'maimai': {
        'diving-fish': {
            id: 'diving-fish',
            name: 'Diving-Fish (国际)',
            description: '水鱼查分器 API，数据稳定',
            sources: ['https://www.diving-fish.com/api/maimaidxprober/music_data'],
            normalize: 'diving-fish-maimai'
        },
        'otoge-intl': {
            id: 'otoge-intl',
            name: 'OTOGE-DB (国际)',
            description: '国际服数据',
            sources: [
                'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/data/music-ex-intl.json',
                'https://raw.githubusercontent.com/zvuc/otoge-db/master/maimai/data/music-ex-intl.json'
            ],
            normalize: 'otoge-maimai'
        }
    },
    'maimai-jp': {
        'otoge-jp': {
            id: 'otoge-jp',
            name: 'OTOGE-DB (日服)',
            description: '日服最新数据，更新最快',
            sources: [
                'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/data/music-ex.json',
                'https://raw.githubusercontent.com/zvuc/otoge-db/master/maimai/data/music-ex.json'
            ],
            normalize: 'otoge-maimai'
        }
    },
    'maimai-cn': {
        'crazykid': {
            id: 'crazykid',
            name: 'CrazyKid 国服数据库',
            description: '国服专用数据，包含国服独占曲目',
            sources: [
                'https://cdn.jsdelivr.net/gh/CrazyKidCN/maimaiDX-CN-songs-database@main/maidata.json',
                'https://raw.githubusercontent.com/CrazyKidCN/maimaiDX-CN-songs-database/main/maidata.json'
            ],
            normalize: 'maimai-cn'
        }
    },
    'chunithm': {
        'diving-fish': {
            id: 'diving-fish',
            name: 'Diving-Fish',
            description: '水鱼查分器 API',
            sources: ['https://www.diving-fish.com/api/chunithmprober/music_data'],
            normalize: 'diving-fish-chunithm'
        },
        'otoge-intl': {
            id: 'otoge-intl',
            name: 'OTOGE-DB (国际)',
            description: '国际服数据',
            sources: [
                'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/chunithm/data/music-ex-intl.json',
                'https://raw.githubusercontent.com/zvuc/otoge-db/master/chunithm/data/music-ex-intl.json'
            ],
            normalize: 'otoge-chunithm'
        }
    },
    'chunithm-jp': {
        'otoge-jp': {
            id: 'otoge-jp',
            name: 'OTOGE-DB (日服)',
            description: '日服最新数据',
            sources: [
                'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/chunithm/data/music-ex.json',
                'https://raw.githubusercontent.com/zvuc/otoge-db/master/chunithm/data/music-ex.json'
            ],
            normalize: 'otoge-chunithm'
        }
    },
    'ongeki': {
        'otoge-jp': {
            id: 'otoge-jp',
            name: 'OTOGE-DB (日服)',
            description: '日服数据，最完整',
            sources: [
                'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/ongeki/data/music-ex.json',
                'https://raw.githubusercontent.com/zvuc/otoge-db/master/ongeki/data/music-ex.json'
            ],
            normalize: 'otoge-ongeki'
        },
        'reiwa': {
            id: 'reiwa',
            name: 'Reiwa',
            description: 'reiwa.f5.si 数据源',
            sources: ['https://reiwa.f5.si/ongeki_all.json'],
            normalize: 'reiwa'
        }
    },
    'taiko': {
        'taikowiki': {
            id: 'taikowiki',
            name: 'Taiko Wiki',
            description: '太鼓 Wiki 数据库',
            sources: [
                'https://cdn.jsdelivr.net/gh/taikowiki/taiko-song-database@main/database.json',
                'https://raw.githubusercontent.com/taikowiki/taiko-song-database/main/database.json'
            ],
            normalize: 'taiko'
        }
    }
};

// 默认选择的数据源（每个游戏的默认数据源 ID）
const DEFAULT_SELECTIONS = {
    'maimai': 'diving-fish',
    'maimai-jp': 'otoge-jp',
    'maimai-cn': 'crazykid',
    'chunithm': 'diving-fish',
    'chunithm-jp': 'otoge-jp',
    'ongeki': 'otoge-jp',
    'taiko': 'taikowiki'
};

// 当前选择的数据源（gameId -> sourceId）
let activeSelections = { ...DEFAULT_SELECTIONS };

// 根据当前选择生成 GAME_CONFIG
function buildGameConfig() {
    const config = {};
    for (const [gameId, game] of Object.entries(GAMES)) {
        const sourceId = activeSelections[gameId];
        const source = DATA_SOURCES[gameId]?.[sourceId];
        if (source) {
            config[gameId] = {
                name: game.name,
                shortName: game.shortName,
                color: game.color,
                sources: source.sources,
                normalize: source.normalize,
                activeSource: sourceId,
                sourceName: source.name
            };
        }
    }
    return config;
}

// 当前活跃配置
let GAME_CONFIG = buildGameConfig();

// 加载保存的配置
function loadActiveConfig() {
    try {
        // 首先使用默认值初始化所有游戏
        activeSelections = { ...DEFAULT_SELECTIONS };
        
        // 然后加载保存的配置，覆盖默认值
        if (fs.existsSync(CONFIG_FILE)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (saved.selections) {
                // 验证保存的选择是否有效
                for (const [gameId, sourceId] of Object.entries(saved.selections)) {
                    if (DATA_SOURCES[gameId]?.[sourceId]) {
                        activeSelections[gameId] = sourceId;
                    }
                }
            }
        }
        
        GAME_CONFIG = buildGameConfig();
        console.log('[配置] 已加载自定义数据源配置');
        for (const [gameId, sourceId] of Object.entries(activeSelections)) {
            const sourceName = DATA_SOURCES[gameId]?.[sourceId]?.name || sourceId;
            console.log(`  - ${GAMES[gameId]?.shortName}: ${sourceName}`);
        }
    } catch (e) {
        console.error('[配置] 加载配置失败，使用默认配置:', e.message);
    }
}

// 保存配置
function saveActiveConfig() {
    try {
        const configDir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({
            selections: activeSelections,
            timestamp: Date.now()
        }, null, 2));
        console.log('[配置] 配置已保存');
    } catch (e) {
        console.error('[配置] 保存配置失败:', e.message);
    }
}

// 切换某个游戏的数据源
function switchGameSource(gameId, sourceId) {
    if (!GAMES[gameId]) {
        return { success: false, error: `未知游戏: ${gameId}` };
    }
    if (!DATA_SOURCES[gameId]?.[sourceId]) {
        return { success: false, error: `游戏 ${gameId} 不支持数据源: ${sourceId}` };
    }
    
    const oldSourceId = activeSelections[gameId];
    activeSelections[gameId] = sourceId;
    GAME_CONFIG = buildGameConfig();
    saveActiveConfig();
    
    return {
        success: true,
        gameId,
        oldSource: oldSourceId,
        newSource: sourceId,
        sourceName: DATA_SOURCES[gameId][sourceId].name
    };
}

// 初始化时加载配置
loadActiveConfig();

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
    // OTOGE-DB maimai 格式 (https://github.com/zvuc/otoge-db)
    if (type === 'otoge-maimai') {
        // 调试：打印第一条原始数据的所有字段
        if (data.length > 0) {
            console.log('[DEBUG otoge-maimai] 原始数据字段示例:', Object.keys(data[0]));
            console.log('[DEBUG otoge-maimai] 第一条原始数据:', JSON.stringify(data[0], null, 2));
        }
        return data.map(s => {
            // otoge-db 格式分为两种:
            // 1. 标准谱面 (SD): lev_bas, lev_adv, lev_exp, lev_mas, lev_remas
            // 2. DX 谱面: dx_lev_bas, dx_lev_adv, dx_lev_exp, dx_lev_mas, dx_lev_remas
            // 需要同时处理两种格式，优先使用 DX 谱面数据
            
            const hasDxChart = s.dx_lev_bas || s.dx_lev_adv || s.dx_lev_exp || s.dx_lev_mas || s.dx_lev_remas;
            const hasStdChart = s.lev_bas || s.lev_adv || s.lev_exp || s.lev_mas || s.lev_remas;
            
            // 判断谱面类型：有 DX 谱面的标记为 DX，否则为 SD
            const chartType = hasDxChart ? 'DX' : 'SD';
            
            // 构建难度数据 - 优先使用 DX 谱面，回退到标准谱面
            const charts = [];
            const levels = [];
            const ds = [];
            
            // DX 谱面数据
            if (hasDxChart) {
                if (s.dx_lev_bas) {
                    charts.push({ difficulty: 'Basic', level: s.dx_lev_bas, ds: parseFloat(s.dx_lev_bas_i) || 0, notes: parseInt(s.dx_lev_bas_notes) || 0 });
                    levels.push(s.dx_lev_bas);
                    ds.push(parseFloat(s.dx_lev_bas_i) || 0);
                }
                if (s.dx_lev_adv) {
                    charts.push({ difficulty: 'Advanced', level: s.dx_lev_adv, ds: parseFloat(s.dx_lev_adv_i) || 0, notes: parseInt(s.dx_lev_adv_notes) || 0 });
                    levels.push(s.dx_lev_adv);
                    ds.push(parseFloat(s.dx_lev_adv_i) || 0);
                }
                if (s.dx_lev_exp) {
                    charts.push({ difficulty: 'Expert', level: s.dx_lev_exp, ds: parseFloat(s.dx_lev_exp_i) || 0, notes: parseInt(s.dx_lev_exp_notes) || 0, designer: s.dx_lev_exp_designer });
                    levels.push(s.dx_lev_exp);
                    ds.push(parseFloat(s.dx_lev_exp_i) || 0);
                }
                if (s.dx_lev_mas) {
                    charts.push({ difficulty: 'Master', level: s.dx_lev_mas, ds: parseFloat(s.dx_lev_mas_i) || 0, notes: parseInt(s.dx_lev_mas_notes) || 0, designer: s.dx_lev_mas_designer });
                    levels.push(s.dx_lev_mas);
                    ds.push(parseFloat(s.dx_lev_mas_i) || 0);
                }
                if (s.dx_lev_remas) {
                    charts.push({ difficulty: 'Re:Master', level: s.dx_lev_remas, ds: parseFloat(s.dx_lev_remas_i) || 0, notes: parseInt(s.dx_lev_remas_notes) || 0, designer: s.dx_lev_remas_designer });
                    levels.push(s.dx_lev_remas);
                    ds.push(parseFloat(s.dx_lev_remas_i) || 0);
                }
            }
            
            // 标准谱面数据 (SD) - 仅在没有 DX 谱面时使用
            if (!hasDxChart && hasStdChart) {
                if (s.lev_bas) {
                    charts.push({ difficulty: 'Basic', level: s.lev_bas, ds: parseFloat(s.lev_bas_i) || 0, notes: parseInt(s.lev_bas_notes) || 0 });
                    levels.push(s.lev_bas);
                    ds.push(parseFloat(s.lev_bas_i) || 0);
                }
                if (s.lev_adv) {
                    charts.push({ difficulty: 'Advanced', level: s.lev_adv, ds: parseFloat(s.lev_adv_i) || 0, notes: parseInt(s.lev_adv_notes) || 0 });
                    levels.push(s.lev_adv);
                    ds.push(parseFloat(s.lev_adv_i) || 0);
                }
                if (s.lev_exp) {
                    charts.push({ difficulty: 'Expert', level: s.lev_exp, ds: parseFloat(s.lev_exp_i) || 0, notes: parseInt(s.lev_exp_notes) || 0, designer: s.lev_exp_designer });
                    levels.push(s.lev_exp);
                    ds.push(parseFloat(s.lev_exp_i) || 0);
                }
                if (s.lev_mas) {
                    charts.push({ difficulty: 'Master', level: s.lev_mas, ds: parseFloat(s.lev_mas_i) || 0, notes: parseInt(s.lev_mas_notes) || 0, designer: s.lev_mas_designer });
                    levels.push(s.lev_mas);
                    ds.push(parseFloat(s.lev_mas_i) || 0);
                }
                if (s.lev_remas) {
                    charts.push({ difficulty: 'Re:Master', level: s.lev_remas, ds: parseFloat(s.lev_remas_i) || 0, notes: parseInt(s.lev_remas_notes) || 0, designer: s.lev_remas_designer });
                    levels.push(s.lev_remas);
                    ds.push(parseFloat(s.lev_remas_i) || 0);
                }
            }
            
            // 封面 URL: otoge-db 使用 image_url 字段，但只有文件名，需要添加基础 URL
            // GitHub raw URL: https://raw.githubusercontent.com/zvuc/otoge-db/master/maimai/jacket/
            // jsDelivr CDN: https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/jacket/
            let coverUrl = null;
            if (s.image_url) {
                // image_url 只是文件名如 "c7cfd8a91e0436ac.png"，需要添加基础 URL
                coverUrl = `https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/jacket/${s.image_url}`;
            } else if (s.id) {
                // 回退到官方 URL
                coverUrl = `https://maimaidx.jp/maimai-mobile/img/Music/${s.id}.png`;
            }
            
            return {
                gameId,
                id: String(s.id || s.sort || Math.random()),
                title: s.title || '',
                artist: s.artist || '',
                category: s.catcode || s.category || '',
                version: s.version || '',
                bpm: s.bpm || 0,
                coverUrl,
                type: chartType,
                levels,
                ds,
                charts,
                // 额外的有用信息
                wikiUrl: s.wiki_url || null,
                dateAdded: s.date_added || null,
                dateIntlAdded: s.date_intl_added || null
            };
        });
    }
    
    // OTOGE-DB CHUNITHM 格式
    if (type === 'otoge-chunithm') {
        return data.map(s => {
            const levels = [s.lev_bas, s.lev_adv, s.lev_exp, s.lev_mas, s.lev_ult].filter(Boolean);
            const ds = [s.lev_bas_i, s.lev_adv_i, s.lev_exp_i, s.lev_mas_i, s.lev_ult_i].filter(v => v !== undefined && v !== null);
            const charts = [];
            
            if (s.lev_bas) charts.push({ difficulty: 'Basic', level: s.lev_bas, ds: s.lev_bas_i || 0 });
            if (s.lev_adv) charts.push({ difficulty: 'Advanced', level: s.lev_adv, ds: s.lev_adv_i || 0 });
            if (s.lev_exp) charts.push({ difficulty: 'Expert', level: s.lev_exp, ds: s.lev_exp_i || 0 });
            if (s.lev_mas) charts.push({ difficulty: 'Master', level: s.lev_mas, ds: s.lev_mas_i || 0 });
            if (s.lev_ult) charts.push({ difficulty: 'Ultima', level: s.lev_ult, ds: s.lev_ult_i || 0 });
            
            const coverUrl = s.image_url || (s.id ? `https://chunithm.sega.jp/storage/json/jacket/${s.id}.png` : null);
            
            return {
                gameId,
                id: String(s.id || s.sort || Math.random()),
                title: s.title || '',
                artist: s.artist || '',
                category: s.catcode || s.category || '',
                version: s.version || '',
                bpm: s.bpm || 0,
                coverUrl,
                levels,
                ds,
                charts
            };
        });
    }
    
    // OTOGE-DB ONGEKI 格式
    if (type === 'otoge-ongeki') {
        return data.map(s => {
            const charts = [];
            
            if (s.lev_bas) charts.push({ difficulty: 'Basic', level: s.lev_bas, ds: s.lev_bas_i || 0 });
            if (s.lev_adv) charts.push({ difficulty: 'Advanced', level: s.lev_adv, ds: s.lev_adv_i || 0 });
            if (s.lev_exp) charts.push({ difficulty: 'Expert', level: s.lev_exp, ds: s.lev_exp_i || 0 });
            if (s.lev_mas) charts.push({ difficulty: 'Master', level: s.lev_mas, ds: s.lev_mas_i || 0 });
            if (s.lev_lnt) charts.push({ difficulty: 'Lunatic', level: s.lev_lnt, ds: s.lev_lnt_i || 0 });
            
            const coverUrl = s.image_url || null;
            
            return {
                gameId,
                id: String(s.id || s.sort || Math.random()),
                title: s.title || '',
                artist: s.artist || '',
                category: s.catcode || s.category || '',
                version: s.version || '',
                bpm: s.bpm || 0,
                coverUrl,
                levels: charts.map(c => c.level),
                ds: charts.map(c => c.ds),
                charts
            };
        });
    }
    
    if (type === 'diving-fish-maimai') {
        return data.map(s => ({
            gameId, // 添加游戏ID
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
            gameId, // 添加游戏ID
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
                gameId, // 添加游戏ID
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
            gameId, // 添加游戏ID
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
        // 太鼓曲风映射
        const genreMap = {
            'pops': 'J-POP',
            'anime': 'アニメ',
            'vocaloid': 'ボーカロイド',
            'variety': 'バラエティ',
            'classical': 'クラシック',
            'game': 'ゲームミュージック',
            'namco': 'ナムコオリジナル',
            'kids': 'キッズ'
        };
        
        return data.map(s => {
            const coverUrl = s.image?.url 
                || s.jacket 
                || s.coverUrl 
                || (s.songNo ? `https://taiko.namco-ch.net/taiko/images/songimage/${s.songNo}.png` : null);
            // 太鼓难度映射
            const diffMap = {
                'easy': 'かんたん',
                'normal': 'ふつう', 
                'hard': 'むずかしい',
                'oni': 'おに',
                'ura': '裏おに'
            };
            const charts = [];
            if (s.courses) {
                Object.entries(s.courses).forEach(([key, val]) => {
                    if (val && typeof val === 'object') {
                        charts.push({
                            difficulty: diffMap[key] || key,
                            level: val.level?.toString() || '?',
                            ds: val.level || 0
                        });
                    }
                });
            }
            
            // 处理 genre 数组 -> 字符串
            let category = '';
            if (Array.isArray(s.genre) && s.genre.length > 0) {
                category = s.genre.map(g => genreMap[g] || g).join(' & ');
            } else if (typeof s.genre === 'string') {
                category = genreMap[s.genre] || s.genre;
            }
            
            // 处理 artists 数组 -> 字符串
            let artist = '';
            if (Array.isArray(s.artists) && s.artists.length > 0) {
                artist = s.artists.join(', ');
            } else if (typeof s.artist === 'string') {
                artist = s.artist;
            }
            
            // 处理 version 数组 -> 取第一个（最新版本）或显示"多平台"
            let version = '';
            if (Array.isArray(s.version) && s.version.length > 0) {
                // 只取第一个版本标识，或者显示平台数量
                version = s.version.length > 3 ? `${s.version.length}平台` : s.version[0];
            } else if (typeof s.version === 'string') {
                version = s.version;
            }
            
            return {
                gameId, // 添加游戏ID
                id: s.songNo || String(Math.random()),
                title: s.title || '',
                artist,
                category,
                version,
                bpm: s.bpm || 0,
                coverUrl,
                levels: charts.map(c => c.level),
                ds: charts.map(c => c.ds),
                charts
            };
        });
    }
    return data.map(s => ({ ...s, gameId })); // 默认情况也添加 gameId
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

// ============== 统一解析 API ==============
app.post('/api/parse-input', (req, res) => {
    try {
        const { input } = req.body;
        if (!input) {
            return res.status(400).json({ success: false, error: '缺少输入内容' });
        }
        const result = parseInput(input);
        console.log(`[解析] 输入识别: ${result.platform} - ${result.type} - ${result.id || result.songs?.length || result.query}`);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('解析输入错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== 短链接解析 API ==============
// 解析 163cn.tv 短链接
app.get('/api/resolve/netease/:shortId', async (req, res) => {
    try {
        const { shortId } = req.params;
        console.log(`[解析] 正在解析网易云短链接: ${shortId}`);
        
        // 网易云短链接会 302 跳转到真实地址
        const shortUrl = `https://163cn.tv/${shortId}`;
        
        const response = await axios.get(shortUrl, {
            maxRedirects: 0, // 不自动跟随重定向
            validateStatus: (status) => status >= 200 && status < 400,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        }).catch(err => {
            // 302 跳转会在这里被捕获
            if (err.response && err.response.status === 302) {
                return err.response;
            }
            throw err;
        });
        
        const location = response.headers.location || response.headers.Location;
        
        if (location) {
            // 从跳转 URL 中提取 ID
            // 歌单: music.163.com/playlist?id=xxx
            // 用户: music.163.com/user/home?id=xxx
            const playlistMatch = location.match(/playlist[?/].*?id[=/](\d+)/i);
            const userMatch = location.match(/user\/home\?id=(\d+)/i);
            
            if (playlistMatch) {
                console.log(`[解析] 网易云短链接解析成功: 歌单 ${playlistMatch[1]}`);
                return res.json({
                    success: true,
                    type: 'playlist',
                    id: playlistMatch[1],
                    resolvedUrl: location
                });
            }
            
            if (userMatch) {
                console.log(`[解析] 网易云短链接解析成功: 用户 ${userMatch[1]}`);
                return res.json({
                    success: true,
                    type: 'user',
                    id: userMatch[1],
                    resolvedUrl: location
                });
            }
        }
        
        res.status(400).json({ success: false, error: '无法解析短链接' });
    } catch (error) {
        console.error('解析网易云短链接错误:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 解析 QQ音乐短链接 (c6.y.qq.com)
app.get('/api/resolve/qqmusic/:shortId', async (req, res) => {
    try {
        const { shortId } = req.params;
        console.log(`[解析] 正在解析QQ音乐短链接: ${shortId}`);
        
        // QQ音乐短链接也是 302 跳转
        const shortUrl = `https://c6.y.qq.com/base/fcgi-bin/u?__=${shortId}`;
        
        const response = await axios.get(shortUrl, {
            maxRedirects: 5, // 允许多次跳转
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        // 最终 URL 会包含歌单/专辑 ID
        const finalUrl = response.request?.res?.responseUrl || response.config?.url;
        
        if (finalUrl) {
            // 歌单: y.qq.com/n/ryqq/playlist/xxx
            const playlistMatch = finalUrl.match(/playlist\/(\d+)/);
            // 专辑: y.qq.com/n/ryqq/albumDetail/xxx
            const albumMatch = finalUrl.match(/albumDetail\/([a-zA-Z0-9]+)/);
            // 歌手: y.qq.com/n/ryqq/singer/xxx
            const singerMatch = finalUrl.match(/singer\/([a-zA-Z0-9]+)/);
            
            if (playlistMatch) {
                console.log(`[解析] QQ音乐短链接解析成功: 歌单 ${playlistMatch[1]}`);
                return res.json({
                    success: true,
                    type: 'playlist',
                    id: playlistMatch[1],
                    resolvedUrl: finalUrl
                });
            }
            
            if (albumMatch) {
                console.log(`[解析] QQ音乐短链接解析成功: 专辑 ${albumMatch[1]}`);
                return res.json({
                    success: true,
                    type: 'album',
                    id: albumMatch[1],
                    resolvedUrl: finalUrl,
                    message: '暂不支持专辑导入'
                });
            }
            
            if (singerMatch) {
                console.log(`[解析] QQ音乐短链接解析成功: 歌手 ${singerMatch[1]}`);
                return res.json({
                    success: true,
                    type: 'singer',
                    id: singerMatch[1],
                    resolvedUrl: finalUrl,
                    message: '暂不支持歌手主页导入'
                });
            }
            
            // 用户主页: i2.y.qq.com/n3/other/pages/share/profile_v2/index.html
            const profileMatch = finalUrl.match(/profile_v2.*encrypt_uin=([^&]+)/);
            if (profileMatch) {
                console.log(`[解析] QQ音乐短链接解析成功: 用户主页 (加密ID)`);
                return res.json({
                    success: false,
                    type: 'profile',
                    error: 'QQ音乐用户主页暂不支持，请分享具体的歌单链接',
                    resolvedUrl: finalUrl
                });
            }
        }
        
        res.status(400).json({ success: false, error: '无法解析短链接或不支持此类型。QQ音乐请分享具体的歌单链接' });
    } catch (error) {
        console.error('解析QQ音乐短链接错误:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== QQ音乐 API ==============
// QQ音乐公开歌单获取（不需要登录）
app.get('/api/qqmusic/playlist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[QQ音乐] 正在获取歌单: ${id}`);
        
        // QQ音乐歌单详情 API
        const detailUrl = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${id}&format=json&platform=yqq.json`;
        
        const response = await axios.get(detailUrl, {
            headers: {
                'Referer': 'https://y.qq.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });
        
        const data = response.data;
        
        if (data.code !== 0 || !data.cdlist || data.cdlist.length === 0) {
            console.error('[QQ音乐] 获取歌单失败:', data);
            return res.status(400).json({ success: false, error: '获取歌单失败，请确认歌单ID正确且为公开歌单' });
        }
        
        const playlist = data.cdlist[0];
        const songs = (playlist.songlist || []).map(s => ({
            id: s.songmid,
            name: s.songname,
            artists: s.singer?.map(a => a.name).join(', ') || '',
            album: s.albumname || '',
            coverUrl: s.albummid ? `https://y.qq.com/music/photo_new/T002R300x300M000${s.albummid}.jpg` : '',
            duration: s.interval * 1000
        }));
        
        console.log(`[QQ音乐] 成功获取 ${songs.length} 首歌曲`);
        
        res.json({
            success: true,
            playlist: {
                id: playlist.disstid,
                name: playlist.dissname,
                coverUrl: playlist.logo,
                trackCount: songs.length,
                creator: playlist.nickname
            },
            songs,
            total: songs.length
        });
    } catch (error) {
        console.error('QQ音乐歌单获取错误:', error.message);
        res.status(500).json({ success: false, error: `获取失败: ${error.message}` });
    }
});

// ============== Bilibili API ==============
// B站用户收藏夹列表
app.get('/api/bilibili/user/:uid/favlist', async (req, res) => {
    try {
        const { uid } = req.params;
        console.log(`[B站] 正在获取用户收藏夹列表: ${uid}`);
        
        // 获取用户创建的收藏夹
        const favUrl = `https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${uid}`;
        
        const response = await axios.get(favUrl, {
            headers: {
                'Referer': 'https://space.bilibili.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        if (response.data.code !== 0) {
            return res.status(400).json({ success: false, error: response.data.message || '获取收藏夹失败' });
        }
        
        const favList = response.data.data?.list || [];
        const playlists = favList.map(fav => ({
            id: fav.id,
            name: fav.title,
            coverUrl: fav.cover,
            trackCount: fav.media_count,
            creator: uid
        }));
        
        console.log(`[B站] 成功获取 ${playlists.length} 个收藏夹`);
        res.json({ success: true, playlists });
    } catch (error) {
        console.error('B站收藏夹获取错误:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// B站收藏夹内容
app.get('/api/bilibili/favlist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const pageSize = 20;
        
        console.log(`[B站] 正在获取收藏夹内容: ${id}, 页码: ${page}`);
        
        // 获取收藏夹内容
        const contentUrl = `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${id}&pn=${page}&ps=${pageSize}&platform=web`;
        
        const response = await axios.get(contentUrl, {
            headers: {
                'Referer': 'https://space.bilibili.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        if (response.data.code !== 0) {
            return res.status(400).json({ success: false, error: response.data.message || '获取收藏夹内容失败' });
        }
        
        const data = response.data.data;
        const medias = data?.medias || [];
        
        // 提取视频标题作为歌曲名（B站很多是音乐视频）
        const songs = medias.map(m => ({
            id: m.bvid || m.id,
            name: m.title,
            artists: m.upper?.name || '',
            album: '',
            coverUrl: m.cover,
            duration: m.duration * 1000
        }));
        
        console.log(`[B站] 成功获取 ${songs.length} 个视频`);
        
        res.json({
            success: true,
            songs,
            total: data?.info?.media_count || songs.length,
            hasMore: data?.has_more || false
        });
    } catch (error) {
        console.error('B站收藏夹内容获取错误:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// B站收藏夹 - 获取全部内容（分页加载）
app.get('/api/bilibili/favlist/:id/all', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[B站] 正在获取收藏夹全部内容: ${id}`);
        
        const allSongs = [];
        let page = 1;
        let hasMore = true;
        const pageSize = 20;
        
        while (hasMore && page <= 50) { // 最多50页防止无限循环
            const contentUrl = `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${id}&pn=${page}&ps=${pageSize}&platform=web`;
            
            const response = await axios.get(contentUrl, {
                headers: {
                    'Referer': 'https://space.bilibili.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });
            
            if (response.data.code !== 0) break;
            
            const data = response.data.data;
            const medias = data?.medias || [];
            
            medias.forEach(m => {
                allSongs.push({
                    id: m.bvid || m.id,
                    name: m.title,
                    artists: m.upper?.name || '',
                    album: '',
                    coverUrl: m.cover,
                    duration: m.duration * 1000
                });
            });
            
            hasMore = data?.has_more || false;
            page++;
            
            // 简单限流
            await new Promise(r => setTimeout(r, 100));
        }
        
        console.log(`[B站] 成功获取 ${allSongs.length} 个视频`);
        res.json({ success: true, songs: allSongs, total: allSongs.length });
    } catch (error) {
        console.error('B站收藏夹全部内容获取错误:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== 文本歌曲解析 API ==============
app.post('/api/text/parse', (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, error: '缺少文本内容' });
        }
        
        // 解析文本，支持多种格式
        // 格式1: 每行一首歌 "歌名"
        // 格式2: 每行 "歌名 - 歌手"
        // 格式3: CSV格式 "歌名,歌手"
        const lines = text.split(/[\n]/).map(l => l.trim()).filter(Boolean);
        
        const songs = lines.map((line, index) => {
            let name = line;
            let artists = '';
            
            // 尝试分割歌名和歌手
            if (line.includes(' - ')) {
                const parts = line.split(' - ');
                name = parts[0].trim();
                artists = parts.slice(1).join(' - ').trim();
            } else if (line.includes(',')) {
                const parts = line.split(',');
                name = parts[0].trim();
                artists = parts.slice(1).join(',').trim();
            } else if (line.includes('|')) {
                const parts = line.split('|');
                name = parts[0].trim();
                artists = parts.slice(1).join('|').trim();
            }
            
            return {
                id: `text_${index}`,
                name,
                artists,
                album: '',
                coverUrl: '',
                duration: 0
            };
        });
        
        console.log(`[文本] 解析了 ${songs.length} 首歌曲`);
        res.json({ success: true, songs, total: songs.length });
    } catch (error) {
        console.error('文本解析错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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

// ============== 封面缓存系统 ==============

// 生成封面文件名（基于 URL hash）
function getCoverFileName(gameId, originalUrl) {
    const crypto = require('crypto');
    const urlHash = crypto.createHash('md5').update(originalUrl).digest('hex').slice(0, 12);
    
    // 安全获取扩展名
    let ext = '.png';
    try {
        if (originalUrl.startsWith('http')) {
            ext = path.extname(new URL(originalUrl).pathname) || '.png';
        } else {
            // 处理相对路径或其他格式
            ext = path.extname(originalUrl) || '.png';
        }
    } catch (e) {
        // URL 解析失败，使用默认扩展名
    }
    
    // 确保扩展名有效
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext.toLowerCase())) {
        ext = '.png';
    }
    
    return `${gameId}_${urlHash}${ext}`;
}

// 获取封面本地路径
function getCoverLocalPath(gameId, originalUrl) {
    const fileName = getCoverFileName(gameId, originalUrl);
    return path.join(COVERS_DIR, gameId, fileName);
}

// 检查封面是否已缓存
function isCoverCached(gameId, originalUrl) {
    const localPath = getCoverLocalPath(gameId, originalUrl);
    return fs.existsSync(localPath);
}

// 下载并缓存封面
async function downloadAndCacheCover(gameId, originalUrl) {
    if (!originalUrl || !coversConfig.enabled) return null;
    
    const localPath = getCoverLocalPath(gameId, originalUrl);
    const gameDir = path.dirname(localPath);
    
    // 确保游戏封面目录存在
    if (!fs.existsSync(gameDir)) {
        fs.mkdirSync(gameDir, { recursive: true });
    }
    
    // 如果已缓存，直接返回
    if (fs.existsSync(localPath)) {
        return localPath;
    }
    
    // 下载封面
    for (let i = 0; i < coversConfig.retryCount; i++) {
        try {
            const response = await axios.get(originalUrl, {
                responseType: 'arraybuffer',
                timeout: coversConfig.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': originalUrl
                }
            });
            
            fs.writeFileSync(localPath, response.data);
            return localPath;
        } catch (e) {
            if (i === coversConfig.retryCount - 1) {
                console.warn(`[封面] 下载失败 (${gameId}): ${originalUrl.slice(0, 50)}...`);
                return null;
            }
        }
    }
    return null;
}

// 批量缓存封面（后台任务）
const coverDownloadQueue = new Map(); // gameId -> Promise

async function batchCacheCovers(gameId, songs) {
    if (!coversConfig.enabled || coverDownloadQueue.has(gameId)) return;
    
    const uncachedSongs = songs.filter(s => s.coverUrl && !isCoverCached(gameId, s.coverUrl));
    if (uncachedSongs.length === 0) return;
    
    console.log(`[封面] 开始缓存 ${gameId}: ${uncachedSongs.length} 张封面`);
    
    const downloadTask = (async () => {
        let downloaded = 0;
        const total = uncachedSongs.length;
        
        // 分批下载，控制并发
        for (let i = 0; i < uncachedSongs.length; i += coversConfig.maxConcurrent) {
            const batch = uncachedSongs.slice(i, i + coversConfig.maxConcurrent);
            await Promise.all(batch.map(async (song) => {
                const result = await downloadAndCacheCover(gameId, song.coverUrl);
                if (result) downloaded++;
            }));
            
            // 每50张输出进度
            if ((i + coversConfig.maxConcurrent) % 50 === 0 || i + coversConfig.maxConcurrent >= total) {
                console.log(`[封面] ${gameId} 进度: ${Math.min(i + coversConfig.maxConcurrent, total)}/${total}`);
            }
        }
        
        console.log(`[封面] ${gameId} 完成: ${downloaded}/${total} 张成功`);
        coverDownloadQueue.delete(gameId);
    })();
    
    coverDownloadQueue.set(gameId, downloadTask);
}

// 获取封面 URL（按需缓存模式）
function getCoverUrl(gameId, originalUrl, req) {
    if (!originalUrl) return null;
    if (!coversConfig.enabled) return originalUrl;
    
    const fileName = getCoverFileName(gameId, originalUrl);
    const protocol = req?.protocol || 'http';
    const host = req?.get('host') || `localhost:${PORT}`;
    
    // 如果配置了 CDN 且封面已缓存，直接返回 CDN URL
    if (coversConfig.cdnBaseUrl && isCoverCached(gameId, originalUrl)) {
        return `${coversConfig.cdnBaseUrl}/${gameId}/${fileName}`;
    }
    
    // 如果已缓存，返回本地代理 URL（不带原始 URL 参数）
    if (isCoverCached(gameId, originalUrl)) {
        return `${protocol}://${host}/api/covers/${gameId}/${fileName}`;
    }
    
    // 未缓存时，返回带原始 URL 的代理地址，触发按需下载
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${protocol}://${host}/api/covers/${gameId}/${fileName}?url=${encodedUrl}`;
}

// 封面代理 API - 按需下载并缓存封面
app.get('/api/covers/:gameId/:fileName', async (req, res) => {
    const { gameId, fileName } = req.params;
    const filePath = path.join(COVERS_DIR, gameId, fileName);
    
    // 如果已缓存，直接返回
    if (fs.existsSync(filePath)) {
        res.set({
            'Cache-Control': 'public, max-age=31536000', // 1年
            'Content-Type': fileName.endsWith('.png') ? 'image/png' : 'image/jpeg'
        });
        return res.sendFile(filePath);
    }
    
    // 从查询参数获取原始 URL
    const originalUrl = req.query.url;
    if (!originalUrl) {
        return res.status(404).json({ error: '封面未找到，且未提供原始 URL' });
    }
    
    // 按需下载
    try {
        console.log(`[封面] 按需下载 ${gameId}: ${fileName}`);
        
        // 确保目录存在
        const gameDir = path.join(COVERS_DIR, gameId);
        if (!fs.existsSync(gameDir)) {
            fs.mkdirSync(gameDir, { recursive: true });
        }
        
        // 下载封面
        const response = await axios.get(originalUrl, {
            responseType: 'arraybuffer',
            timeout: coversConfig.timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // 保存到本地
        fs.writeFileSync(filePath, response.data);
        console.log(`[封面] 缓存成功 ${gameId}: ${fileName}`);
        
        // 返回图片
        res.set({
            'Cache-Control': 'public, max-age=31536000',
            'Content-Type': response.headers['content-type'] || 'image/png'
        });
        res.send(response.data);
    } catch (error) {
        console.error(`[封面] 下载失败 ${gameId}: ${fileName} - ${error.message}`);
        // 下载失败时重定向到原始 URL
        res.redirect(originalUrl);
    }
});

// 封面配置 API
app.get('/api/admin/covers/config', (req, res) => {
    // 统计封面缓存
    let totalCovers = 0;
    let totalSize = 0;
    const gameStats = {};
    
    if (fs.existsSync(COVERS_DIR)) {
        const gameDirs = fs.readdirSync(COVERS_DIR);
        for (const gameId of gameDirs) {
            const gameDir = path.join(COVERS_DIR, gameId);
            if (fs.statSync(gameDir).isDirectory()) {
                const files = fs.readdirSync(gameDir);
                const count = files.length;
                let size = 0;
                for (const file of files) {
                    size += fs.statSync(path.join(gameDir, file)).size;
                }
                gameStats[gameId] = { count, size };
                totalCovers += count;
                totalSize += size;
            }
        }
    }
    
    res.json({
        success: true,
        config: coversConfig,
        stats: {
            totalCovers,
            totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            byGame: gameStats
        },
        coversDir: COVERS_DIR
    });
});

// 更新封面配置
app.post('/api/admin/covers/config', express.json(), (req, res) => {
    const { enabled, cdnBaseUrl, maxConcurrent, retryCount, timeout } = req.body;
    
    if (typeof enabled === 'boolean') coversConfig.enabled = enabled;
    if (typeof cdnBaseUrl === 'string') coversConfig.cdnBaseUrl = cdnBaseUrl.replace(/\/$/, '');
    if (typeof maxConcurrent === 'number') coversConfig.maxConcurrent = Math.max(1, Math.min(20, maxConcurrent));
    if (typeof retryCount === 'number') coversConfig.retryCount = Math.max(1, Math.min(10, retryCount));
    if (typeof timeout === 'number') coversConfig.timeout = Math.max(5000, Math.min(60000, timeout));
    
    saveCoversConfig();
    console.log('[封面] 配置已更新:', coversConfig);
    
    res.json({ success: true, config: coversConfig });
});

// 手动触发封面缓存
app.post('/api/admin/covers/cache/:gameId', async (req, res) => {
    const { gameId } = req.params;
    
    if (!GAMES[gameId]) {
        return res.status(400).json({ success: false, error: '无效的游戏ID' });
    }
    
    try {
        const songs = await fetchGameSongs(gameId);
        if (songs.length === 0) {
            return res.json({ success: false, error: '没有歌曲数据' });
        }
        
        // 统计缓存状态
        const cached = songs.filter(s => s.coverUrl && isCoverCached(gameId, s.coverUrl)).length;
        const uncached = songs.filter(s => s.coverUrl && !isCoverCached(gameId, s.coverUrl)).length;
        
        // 开始后台缓存
        batchCacheCovers(gameId, songs);
        
        res.json({
            success: true,
            message: `开始缓存 ${gameId} 封面`,
            stats: {
                total: songs.length,
                cached,
                uncached,
                inProgress: coverDownloadQueue.has(gameId)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 清除封面缓存
app.post('/api/admin/covers/clear', (req, res) => {
    const { gameId } = req.body;
    
    try {
        if (gameId) {
            const gameDir = path.join(COVERS_DIR, gameId);
            if (fs.existsSync(gameDir)) {
                fs.rmSync(gameDir, { recursive: true });
                console.log(`[封面] 已清除: ${gameId}`);
            }
        } else {
            // 清除所有封面
            if (fs.existsSync(COVERS_DIR)) {
                fs.rmSync(COVERS_DIR, { recursive: true });
                fs.mkdirSync(COVERS_DIR, { recursive: true });
                console.log('[封面] 已清除所有封面缓存');
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== 歌曲试听 API ==============
app.get('/api/netease/song/:id/url', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await song_url({ id, br: 320000 }); // 320kbps

        if (result.body.code === 200 && result.body.data && result.body.data.length > 0) {
            const urlData = result.body.data[0];

            // 检测 VIP 试听限制
            let isVip = false;
            let previewDuration = null;

            if (urlData.freeTrialInfo && urlData.freeTrialInfo.end > 0) {
                isVip = true;
                previewDuration = urlData.freeTrialInfo.end; // 秒
            } else if (urlData.fee === 1 && urlData.payed === 0 && urlData.size < 500000) {
                isVip = true;
                // 根据文件大小估算试听时长（粗略估计）
                previewDuration = 30;
            }

            res.json({
                success: true,
                url: urlData.url,
                br: urlData.br,
                size: urlData.size,
                type: urlData.type,
                isVip,
                previewDuration
            });
        } else {
            res.json({ success: false, error: '无法获取试听链接（可能需要 VIP）' });
        }
    } catch (error) {
        console.error('获取试听链接错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== 歌曲高潮时间点 API（永久缓存） ==============

// 高潮缓存：内存 + 文件双层缓存，永不过期
const chorusCacheFile = path.join(__dirname, '.cache', 'chorus-cache.json');
const chorusCache = new Map(); // 内存缓存：songId -> { startTime, endTime }

// 启动时从文件加载缓存
try {
    if (fs.existsSync(chorusCacheFile)) {
        const data = JSON.parse(fs.readFileSync(chorusCacheFile, 'utf-8'));
        let count = 0;
        for (const [id, val] of Object.entries(data)) {
            chorusCache.set(id, val);
            count++;
        }
        console.log(`[高潮缓存] 从文件加载了 ${count} 条缓存`);
    }
} catch (e) {
    console.warn('[高潮缓存] 加载缓存文件失败:', e.message);
}

// 保存缓存到文件（防抖，避免频繁写入）
let chorusSaveTimer = null;
function saveChorusCache() {
    if (chorusSaveTimer) clearTimeout(chorusSaveTimer);
    chorusSaveTimer = setTimeout(() => {
        try {
            const cacheDir = path.dirname(chorusCacheFile);
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
            const obj = Object.fromEntries(chorusCache);
            fs.writeFileSync(chorusCacheFile, JSON.stringify(obj), 'utf-8');
        } catch (e) {
            console.warn('[高潮缓存] 保存缓存文件失败:', e.message);
        }
    }, 2000); // 2秒防抖
}

app.get('/api/netease/song/:id/chorus', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. 先查内存缓存
        if (chorusCache.has(id)) {
            return res.json({ success: true, cached: true, ...chorusCache.get(id) });
        }

        // 2. 调用网易云 API
        const result = await song_chorus({ id });

        if (result.body.code === 200 && result.body.chorus && result.body.chorus.length > 0) {
            const chorus = result.body.chorus[0];
            const data = {
                startTime: chorus.startTime,  // 毫秒
                endTime: chorus.endTime        // 毫秒
            };

            // 3. 写入缓存（永久）
            chorusCache.set(id, data);
            saveChorusCache();

            res.json({ success: true, cached: false, ...data });
        } else {
            // 没有高潮数据，也缓存一个空结果避免重复请求
            chorusCache.set(id, { startTime: null, endTime: null });
            saveChorusCache();

            res.json({ success: false, error: '该歌曲无高潮标记数据' });
        }
    } catch (error) {
        console.error('[高潮] 获取错误:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 批量获取高潮数据（一次请求多首歌，减少前端请求次数）
app.post('/api/netease/songs/chorus', async (req, res) => {
    try {
        const { ids } = req.body; // 数组: ["123", "456", ...]
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: '请提供歌曲 ID 数组' });
        }

        // 限制单次最多 50 首
        const limitedIds = ids.slice(0, 50);
        const results = {};
        const uncachedIds = [];

        // 先从缓存取
        for (const id of limitedIds) {
            const sid = String(id);
            if (chorusCache.has(sid)) {
                results[sid] = chorusCache.get(sid);
            } else {
                uncachedIds.push(sid);
            }
        }

        // 未缓存的逐个请求（串行，避免被限流）
        for (const id of uncachedIds) {
            try {
                const result = await song_chorus({ id });
                if (result.body.code === 200 && result.body.chorus && result.body.chorus.length > 0) {
                    const chorus = result.body.chorus[0];
                    const data = { startTime: chorus.startTime, endTime: chorus.endTime };
                    chorusCache.set(id, data);
                    results[id] = data;
                } else {
                    chorusCache.set(id, { startTime: null, endTime: null });
                    results[id] = { startTime: null, endTime: null };
                }
            } catch (e) {
                results[id] = { startTime: null, endTime: null, error: e.message };
            }
        }

        // 有新数据就保存
        if (uncachedIds.length > 0) saveChorusCache();

        res.json({
            success: true,
            total: limitedIds.length,
            cached: limitedIds.length - uncachedIds.length,
            fetched: uncachedIds.length,
            results
        });
    } catch (error) {
        console.error('[高潮批量] 获取错误:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== 街机歌曲音频搜索 API（网易云优先 + QQ音乐备用，永久缓存） ==============

const arcadeAudioCacheFile = path.join(__dirname, '.cache', 'arcade-audio-cache.json');
const arcadeAudioCache = new Map(); // key: "gameId_songId" → { neteaseId, qqmid, title, artist, source }

// 启动时加载缓存
try {
    if (fs.existsSync(arcadeAudioCacheFile)) {
        const data = JSON.parse(fs.readFileSync(arcadeAudioCacheFile, 'utf-8'));
        let count = 0;
        for (const [k, v] of Object.entries(data)) {
            arcadeAudioCache.set(k, v);
            count++;
        }
        console.log(`[原曲缓存] 从文件加载了 ${count} 条缓存`);
    }
} catch (e) {
    console.warn('[原曲缓存] 加载缓存文件失败:', e.message);
}

let arcadeAudioSaveTimer = null;
function saveArcadeAudioCache() {
    if (arcadeAudioSaveTimer) clearTimeout(arcadeAudioSaveTimer);
    arcadeAudioSaveTimer = setTimeout(() => {
        try {
            const cacheDir = path.dirname(arcadeAudioCacheFile);
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(arcadeAudioCacheFile, JSON.stringify(Object.fromEntries(arcadeAudioCache)), 'utf-8');
        } catch (e) {
            console.warn('[原曲缓存] 保存失败:', e.message);
        }
    }, 2000);
}

// 简易字符串相似度（用于从搜索结果选最佳匹配）
function stringSimilarity(a, b) {
    if (!a || !b) return 0;
    a = a.toLowerCase().trim();
    b = b.toLowerCase().trim();
    if (a === b) return 1;
    // 包含关系
    if (a.includes(b) || b.includes(a)) return 0.8;
    // Jaccard on bigrams
    const bigrams = (s) => {
        const set = new Set();
        for (let i = 0; i < s.length - 1; i++) set.add(s.substring(i, i + 2));
        return set;
    };
    const setA = bigrams(a);
    const setB = bigrams(b);
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const bg of setA) { if (setB.has(bg)) intersection++; }
    return intersection / (setA.size + setB.size - intersection);
}

// 从网易云搜索街机歌曲
async function searchNetease(title, artist) {
    try {
        const keywords = artist ? `${title} ${artist}` : title;
        const result = await cloudsearch({ keywords, limit: 8, type: 1 });
        const songs = result.body?.result?.songs;
        if (!songs || songs.length === 0) return null;

        // 选标题最相似的
        let best = null, bestScore = -1;
        for (const s of songs) {
            const titleSim = stringSimilarity(s.name, title);
            const artistNames = (s.ar || []).map(a => a.name).join(' ');
            const artistSim = artist ? stringSimilarity(artistNames, artist) * 0.3 : 0;
            const score = titleSim + artistSim;
            if (score > bestScore) {
                bestScore = score;
                best = s;
            }
        }

        if (best && bestScore > 0.3) {
            return {
                neteaseId: best.id,
                title: best.name,
                artist: (best.ar || []).map(a => a.name).join(', '),
                source: 'netease'
            };
        }
        return null;
    } catch (e) {
        console.warn('[原曲搜索] 网易云搜索失败:', e.message);
        return null;
    }
}

// 从QQ音乐搜索（备用）
async function searchQQMusic(title, artist) {
    try {
        const keywords = artist ? `${title} ${artist}` : title;
        const resp = await axios.get('https://c.y.qq.com/soso/fcgi-bin/client_search_cp', {
            params: { w: keywords, format: 'json', p: 1, n: 5, cr: 1 },
            headers: { 'Referer': 'https://y.qq.com', 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000
        });
        const songs = resp.data?.data?.song?.list;
        if (!songs || songs.length === 0) return null;

        let best = null, bestScore = -1;
        for (const s of songs) {
            const titleSim = stringSimilarity(s.songname, title);
            const singerNames = (s.singer || []).map(a => a.name).join(' ');
            const artistSim = artist ? stringSimilarity(singerNames, artist) * 0.3 : 0;
            const score = titleSim + artistSim;
            if (score > bestScore) {
                bestScore = score;
                best = s;
            }
        }

        if (best && bestScore > 0.3) {
            return {
                qqmid: best.songmid,
                qqid: best.songid,
                title: best.songname,
                artist: (best.singer || []).map(a => a.name).join(', '),
                source: 'qqmusic'
            };
        }
        return null;
    } catch (e) {
        console.warn('[原曲搜索] QQ音乐搜索失败:', e.message);
        return null;
    }
}

// 获取网易云音频URL
// 获取网易云音频URL（检测 VIP 试听片段，返回包含VIP状态的对象）
async function getNeteaseAudioUrl(neteaseId) {
    try {
        const result = await song_url({ id: neteaseId, br: 320000 });
        if (result.body.code !== 200 || !result.body.data?.[0]?.url) return null;

        const d = result.body.data[0];
        let isVip = false;
        let previewDuration = null;

        // 检测 VIP 试听片段：freeTrialInfo 存在且 end > 0 表示只有部分试听
        if (d.freeTrialInfo && d.freeTrialInfo.end > 0) {
            isVip = true;
            previewDuration = d.freeTrialInfo.end;
            console.log(`[原曲] 网易云 ${neteaseId} 是 VIP 试听 (${d.freeTrialInfo.end}s)`);
        }

        // fee=1 且 payed=0 也是 VIP 未付费，但有些歌仍能播完整版，用 size 兜底判断
        // 如果文件小于 500KB 大概率是试听片段
        else if (d.fee === 1 && d.payed === 0 && d.size < 500000) {
            isVip = true;
            previewDuration = 30; // 估算30秒
            console.log(`[原曲] 网易云 ${neteaseId} 疑似 VIP 短片段 (size=${d.size})`);
        }

        return {
            url: d.url,
            isVip,
            previewDuration
        };
    } catch {
        return null;
    }
}

// 获取QQ音乐音频URL
async function getQQMusicAudioUrl(songmid) {
    try {
        // 方法1: 公开流媒体链接
        const url = `https://ws.stream.qqmusic.qq.com/C400${songmid}.m4a?fromtag=38`;
        const resp = await axios.head(url, { timeout: 5000, maxRedirects: 3 });
        if (resp.status === 200) return url;
        return null;
    } catch {
        // 方法2: 备用域名
        try {
            const url2 = `https://isure.stream.qqmusic.qq.com/C400${songmid}.m4a?fromtag=38`;
            const resp2 = await axios.head(url2, { timeout: 5000, maxRedirects: 3 });
            if (resp2.status === 200) return url2;
        } catch {}
        return null;
    }
}

app.get('/api/arcade-song/:gameId/:songId/audio', async (req, res) => {
    try {
        const { gameId, songId } = req.params;
        const { title, artist } = req.query;
        const cacheKey = `${gameId}_${songId}`;

        // 1. 查缓存
        if (arcadeAudioCache.has(cacheKey)) {
            const cached = arcadeAudioCache.get(cacheKey);

            // 缓存了"找不到"的结果
            if (!cached.neteaseId && !cached.qqmid) {
                return res.json({ success: false, cached: true, error: '未找到该歌曲的音频源' });
            }

            // 从缓存的源获取 URL（按优先级尝试：QQ音乐 > 网易云，因为网易云可能是VIP）
            let url = null;
            let actualSource = cached.source;

            // 先尝试 QQ 音乐（无 VIP 限制）
            let vipInfo = { isVip: false, previewDuration: null };
            if (cached.qqmid) {
                url = await getQQMusicAudioUrl(cached.qqmid);
                if (url) actualSource = 'qqmusic';
            }
            // QQ 音乐失败才尝试网易云
            if (!url && cached.neteaseId) {
                const neteaseResult = await getNeteaseAudioUrl(cached.neteaseId);
                if (neteaseResult) {
                    url = neteaseResult.url;
                    vipInfo = { isVip: neteaseResult.isVip, previewDuration: neteaseResult.previewDuration };
                    actualSource = 'netease';
                }
            }

            if (url) {
                return res.json({
                    success: true, cached: true, url,
                    source: cached.source,
                    matchedTitle: cached.title,
                    matchedArtist: cached.artist,
                    neteaseId: cached.neteaseId || null,
                    isVip: vipInfo.isVip,
                    previewDuration: vipInfo.previewDuration
                });
            }
            return res.json({ success: false, cached: true, error: '音频链接暂不可用' });
        }

        if (!title) {
            return res.status(400).json({ success: false, error: '缺少 title 参数' });
        }

        // 2. 并行搜索两个平台（都搜，保存两边的 ID，方便 fallback）
        const [neteaseResult, qqResult] = await Promise.allSettled([
            searchNetease(title, artist),
            searchQQMusic(title, artist)
        ]);

        const neteaseMatch = neteaseResult.status === 'fulfilled' ? neteaseResult.value : null;
        const qqMatch = qqResult.status === 'fulfilled' ? qqResult.value : null;

        // 合并缓存数据（保存两边的 ID）
        const cacheData = {
            neteaseId: neteaseMatch?.neteaseId || null,
            qqmid: qqMatch?.qqmid || null,
            title: neteaseMatch?.title || qqMatch?.title || title,
            artist: neteaseMatch?.artist || qqMatch?.artist || artist,
            source: null
        };

        // 3. 获取可播放的 URL（QQ 音乐优先，因为没有 VIP 限制）
        let url = null;
        let source = '';
        let vipInfo = { isVip: false, previewDuration: null };

        // 先试 QQ 音乐
        if (qqMatch?.qqmid) {
            url = await getQQMusicAudioUrl(qqMatch.qqmid);
            if (url) { source = 'qqmusic'; cacheData.source = 'qqmusic'; }
        }

        // QQ 音乐失败，试网易云（可能是 VIP 试听）
        if (!url && neteaseMatch?.neteaseId) {
            const neteaseResult = await getNeteaseAudioUrl(neteaseMatch.neteaseId);
            if (neteaseResult) {
                url = neteaseResult.url;
                vipInfo = { isVip: neteaseResult.isVip, previewDuration: neteaseResult.previewDuration };
                source = 'netease';
                cacheData.source = 'netease';
            }
        }

        // 4. 缓存结果（不管成不成功都缓存，保存两边的 ID）
        arcadeAudioCache.set(cacheKey, cacheData);
        saveArcadeAudioCache();

        if (url) {
            return res.json({
                success: true, cached: false, url, source,
                matchedTitle: cacheData.title,
                matchedArtist: cacheData.artist,
                neteaseId: cacheData.neteaseId,
                isVip: vipInfo.isVip,
                previewDuration: vipInfo.previewDuration
            });
        }

        res.json({ success: false, cached: false, error: '未找到可播放的音频源（VIP 歌曲或版权限制）' });

    } catch (error) {
        console.error('[原曲音频] 错误:', error.message);
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

        // Levenshtein 编辑距离
        // ⚡ Bolt Optimization: Replace O(N * M) 2D array with O(min(N, M)) 1D Uint16Array.
        // This dramatically reduces Garbage Collection pressure during fuzzy matching.
        const levenshteinDistance = (s1, s2) => {
            if (s1 === s2) return 0;
            if (s1.length === 0) return s2.length;
            if (s2.length === 0) return s1.length;
            
            if (s1.length > s2.length) {
                const temp = s1;
                s1 = s2;
                s2 = temp;
            }

            const len1 = s1.length;
            const len2 = s2.length;

            const row = new Uint16Array(len1 + 1);

            for (let i = 0; i <= len1; i++) {
                row[i] = i;
            }
            
            for (let i = 1; i <= len2; i++) {
                let prevDiagonal = row[0];
                row[0] = i;

                const char2 = s2.charCodeAt(i - 1);
                for (let j = 1; j <= len1; j++) {
                    const temp = row[j];
                    if (s1.charCodeAt(j - 1) === char2) {
                        row[j] = prevDiagonal;
                    } else {
                        row[j] = Math.min(
                            row[j - 1] + 1,     // Insert
                            row[j] + 1,         // Delete
                            prevDiagonal + 1    // Replace
                        );
                    }
                    prevDiagonal = temp;
                }
            }

            return row[len1];
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
                .replace(/[,，、&＆×x]/g, '') // 去除分隔符
                .replace(/feat\.?/gi, '')
                .replace(/cv[.:]?/gi, '')
                .replace(/[(（][^)）]*[)）]/g, ''); // 去除括号内容
        };

        const artistMatch = (userArtist, gameArtist) => {
            const ua = normalizeArtist(userArtist);
            const ga = normalizeArtist(gameArtist);
            // 无法判断时给较低分数，避免误匹配
            if (!ua || !ga) return 0.3;
            if (ua === ga) return 1.0;
            // 完全包含关系
            if (ua.includes(ga) || ga.includes(ua)) return 0.85;
            // 检查是否有共同的艺术家名片段（至少3个字符）
            const uaParts = ua.split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(p => p.length >= 3);
            const gaParts = ga.split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(p => p.length >= 3);
            for (const up of uaParts) {
                for (const gp of gaParts) {
                    if (up === gp) return 0.7;
                    if (up.includes(gp) || gp.includes(up)) return 0.5;
                }
            }
            return 0.1; // 降低完全不匹配的分数
        };
        
        // 计算标题长度相似度（避免短标题误匹配长标题）
        const lengthSimilarity = (str1, str2) => {
            const len1 = str1.length;
            const len2 = str2.length;
            if (len1 === 0 || len2 === 0) return 0;
            const ratio = Math.min(len1, len2) / Math.max(len1, len2);
            return ratio;
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
                    const finalScore = 0.9 + (artistScore * 0.1);
                    
                    // 生成匹配标签
                    const tags = [];
                    
                    // 完美匹配：标题精确匹配 + 艺术家高度匹配
                    if (artistScore >= 0.7) {
                        tags.push('perfect_match'); // 完美匹配
                        tags.push('same_artist');
                    } else if (artistScore >= 0.3) {
                        tags.push('similar_artist'); // 相似歌手
                    } else {
                        tags.push('different_artist'); // 可能翻唱/游戏版本
                    }
                    tags.push('exact_title'); // 标题完全匹配
                    
                    match = {
                        userSong,
                        arcadeSong,
                        score: finalScore,
                        matchType: artistScore >= 0.7 ? 'exact' : 'fuzzy',
                        tags,
                        artistScore // 保存艺术家分数供前端使用
                    };
                }
                // 模糊匹配 (使用 fuzzysort)
                else {
                    // 短标题（<6字符）需要更严格的匹配
                    const isShortTitle = userSong.name.length < 6;
                    const threshold = isShortTitle ? -500 : -1200; // 更严格的阈值
                    
                    const results = fuzzysort.go(userSong.name, preparedSongs, {
                        key: 'preparedTitle',
                        limit: 3,
                        threshold: threshold
                    });

                    // 从候选结果中选择最佳匹配
                    let bestMatch = null;
                    let bestScore = 0;

                    for (const result of results) {
                        const arcadeTitle = result.obj.title || '';
                        const userTitle = userSong.name;
                        
                        // 计算标题相似度
                        const titleScore = Math.max(0, (result.score + 1200) / 1200);
                        
                        // 长度相似度检查 - 更严格
                        const lenScore = lengthSimilarity(userTitle, arcadeTitle);
                        
                        // 长度差异过大直接跳过
                        if (lenScore < 0.6) continue;
                        
                        // 短标题必须几乎完全匹配
                        if (isShortTitle && titleScore < 0.85) continue;
                        
                        // 标准化后的标题
                        const normalizedUser = normalizeTitle(userTitle);
                        const normalizedArcade = normalizeTitle(arcadeTitle);
                        
                        // 计算编辑距离相似度（更精确）
                        const editDistScore = 1 - (levenshteinDistance(normalizedUser, normalizedArcade) / Math.max(normalizedUser.length, normalizedArcade.length, 1));
                        
                        // 如果编辑距离相似度太低，跳过
                        if (editDistScore < 0.7) continue;
                        
                        const artistScore = artistMatch(userSong.artists, result.obj.artist);
                        
                        // 标题几乎完全相同（>=95%）时，艺术家权重降低（可能是翻唱/游戏版本）
                        // 标题不太相同时，需要艺术家来辅助确认
                        let combinedScore;
                        if (editDistScore >= 0.95) {
                            // 标题几乎完全匹配，主要看标题
                            combinedScore = (editDistScore * 0.70) + (artistScore * 0.15) + (lenScore * 0.15);
                        } else if (editDistScore >= 0.85) {
                            // 标题比较相似，艺术家起辅助作用
                            // 但如果艺术家完全不匹配，需要更高的标题相似度
                            if (artistScore < 0.15) continue; // 艺术家完全不匹配时跳过
                            combinedScore = (editDistScore * 0.55) + (artistScore * 0.30) + (lenScore * 0.15);
                        } else {
                            // 标题相似度较低，需要艺术家强力支持
                            if (artistScore < 0.3) continue;
                            combinedScore = (editDistScore * 0.45) + (artistScore * 0.40) + (lenScore * 0.15);
                        }
                        
                        // 阈值 0.88（88%）
                        const minCombinedScore = 0.88;
                        if (combinedScore >= minCombinedScore && combinedScore > bestScore) {
                            // 生成匹配标签
                            const tags = [];
                            
                            // 完美匹配：标题高度相似 + 艺术家高度匹配
                            if (editDistScore >= 0.95 && artistScore >= 0.7) {
                                tags.push('perfect_match'); // 完美匹配
                            }
                            
                            // 艺术家标签
                            if (artistScore >= 0.7) {
                                tags.push('same_artist'); // 同歌手
                            } else if (artistScore >= 0.3) {
                                tags.push('similar_artist'); // 相似歌手
                            } else {
                                tags.push('different_artist'); // 可能翻唱/游戏版本
                            }
                            
                            // 标题标签
                            if (editDistScore >= 0.95) {
                                tags.push('exact_title'); // 标题完全匹配
                            } else {
                                tags.push('similar_title'); // 标题相似
                            }
                            
                            bestScore = combinedScore;
                            bestMatch = {
                                userSong,
                                arcadeSong: result.obj,
                                score: combinedScore,
                                matchType: combinedScore >= 0.95 ? 'exact' : 'fuzzy',
                                tags,
                                artistScore,
                                titleScore: editDistScore
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
                    // 收集匹配结果用于日志，并处理封面 URL
                    batchResults.forEach(({ matches }) => {
                        Object.entries(matches).forEach(([gameId, match]) => {
                            if (!matchResultsForLog[gameId]) {
                                matchResultsForLog[gameId] = { matches: [] };
                            }
                            matchResultsForLog[gameId].matches.push(match);
                            
                            // 替换封面 URL 为缓存版本
                            if (match.arcadeSong && match.arcadeSong.coverUrl) {
                                match.arcadeSong.coverUrl = getCoverUrl(gameId, match.arcadeSong.coverUrl, req);
                            }
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

// ============== 公开 API (适用于机器人/第三方集成) ==============

// ============== 单曲分享图生成 ==============
const SONG_IMAGE_DIR = path.join(__dirname, '.song_images');
if (!fs.existsSync(SONG_IMAGE_DIR)) {
    fs.mkdirSync(SONG_IMAGE_DIR, { recursive: true });
}

// 定期清理旧的单曲图片 (保留1小时)
setInterval(() => {
    try {
        const files = fs.readdirSync(SONG_IMAGE_DIR);
        const now = Date.now();
        let cleaned = 0;
        for (const file of files) {
            const filePath = path.join(SONG_IMAGE_DIR, file);
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > 60 * 60 * 1000) {
                fs.unlinkSync(filePath);
                cleaned++;
            }
        }
        if (cleaned > 0) console.log(`[单曲图] 清理了 ${cleaned} 张过期图片`);
    } catch (e) {}
}, 30 * 60 * 1000);

/**
 * 生成单曲分享图
 */
async function generateSongImage(song, gameConfig, websiteUrl) {
    const escapeXml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    const songId = `${song.gameId}_${song.id}_${Date.now()}`;
    const imagePath = path.join(SONG_IMAGE_DIR, `${songId}.png`);
    
    // 获取封面图片 Base64
    let coverBase64 = null;
    if (song.coverUrl) {
        try {
            const coverResp = await axios.get(song.coverUrl, { 
                responseType: 'arraybuffer',
                timeout: 5000 
            });
            coverBase64 = `data:image/png;base64,${Buffer.from(coverResp.data).toString('base64')}`;
        } catch (e) {
            console.warn('[单曲图] 封面获取失败:', e.message);
        }
    }
    
    // 获取游戏 Logo
    let gameLogoBase64 = null;
    const GAME_LOGOS = {
        'maimai': 'logos/maimai-intl.png',
        'maimai-jp': 'logos/maimai-jp.png',
        'maimai-cn': 'logos/maimai-cn.png',
        'chunithm': 'logos/chunithm-intl.png',
        'chunithm-jp': 'logos/chunithm-jp.webp',
        'ongeki': 'logos/ongeki.webp',
        'taiko': 'logos/taiko.png'
    };
    
    const logoRelPath = GAME_LOGOS[song.gameId];
    if (logoRelPath) {
        try {
            const logoPath = path.join(__dirname, '../frontend/public', logoRelPath);
            if (fs.existsSync(logoPath)) {
                let logoBuffer = fs.readFileSync(logoPath);
                // WEBP 格式需要转换为 PNG (SVG 不支持 webp base64)
                if (logoRelPath.endsWith('.webp')) {
                    logoBuffer = await sharp(logoBuffer).png().toBuffer();
                }
                gameLogoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            }
        } catch (e) {
            console.warn('[单曲图] 游戏Logo获取失败:', e.message);
        }
    }

    // 生成二维码 (指向网站首页)
    const qrTargetUrl = websiteUrl || 'http://localhost:5173';
    let qrCodeBase64 = null;
    try {
        qrCodeBase64 = await QRCode.toDataURL(qrTargetUrl, {
            margin: 1,
            color: {
                dark: '#334155',
                light: '#00000000'
            },
            width: 100
        });
    } catch (e) {
        console.warn('[单曲图] 二维码生成失败:', e.message);
    }
    
    // 难度颜色
    const difficultyColors = {
        'Basic': '#22c55e',
        'Advanced': '#eab308',
        'Expert': '#ef4444',
        'Master': '#a855f7',
        'Re:Master': '#f472b6',
        'Ultima': '#1e293b',
        'Lunatic': '#ec4899',
        'かんたん': '#ef4444',
        'ふつう': '#eab308',
        'むずかしい': '#22c55e',
        'おに': '#ec4899',
        '裏おに': '#a855f7'
    };
    
    // 生成难度块
    const charts = song.charts || [];
    const maxDiffs = 5;
    const displayCharts = charts.slice(0, maxDiffs);
    // 计算整体宽度，每个块宽 64，间距 8
    const totalDiffWidth = displayCharts.length * 64 + (displayCharts.length - 1) * 8;
    const startX = (480 - 40 - totalDiffWidth) / 2; // (总宽 - 卡片边距 - 内容宽) / 2
    
    const diffBlocks = displayCharts.map((c, i) => {
        const color = difficultyColors[c.difficulty] || '#64748b';
        const x = startX + i * 72;
        let shortDiff = c.difficulty?.substring(0, 3).toUpperCase() || '?';
        if (c.difficulty === 'Re:Master') shortDiff = 'REM';
        
        return `
            <g transform="translate(${x}, 0)">
                <rect width="64" height="48" rx="10" fill="${color}"/>
                <text x="32" y="16" font-size="9" fill="white" text-anchor="middle" font-weight="800" letter-spacing="0.5" opacity="0.9">${escapeXml(shortDiff)}</text>
                <text x="32" y="38" font-size="18" fill="white" text-anchor="middle" font-weight="900">${escapeXml(String(c.level || '?'))}</text>
            </g>
        `;
    }).join('');
    
    // 游戏颜色
    const gameColor = gameConfig?.color || '#22d3ee';
    
    const width = 480;
    const height = 760;
    
    // 动态计算字号以防溢出
    const title = song.title || '';
    const artist = song.artist || '';
    // 标题字号：基准 28，超过 14 字符开始缩小，最小 18
    const titleFontSize = title.length > 14 ? Math.max(18, 28 - (title.length - 14) * 0.8) : 28;
    // 艺术家字号：基准 15
    const artistFontSize = artist.length > 24 ? 13 : 15;
    
    // BPM 格式化 (太鼓等游戏的 BPM 可能是对象 {min, max})
    let bpmText = '?';
    if (song.bpm) {
        if (typeof song.bpm === 'object') {
            if (song.bpm.min && song.bpm.max) {
                bpmText = song.bpm.min === song.bpm.max ? String(song.bpm.min) : `${song.bpm.min}-${song.bpm.max}`;
            } else if (song.bpm.min) {
                bpmText = String(song.bpm.min);
            } else if (song.bpm.max) {
                bpmText = String(song.bpm.max);
            }
        } else {
            bpmText = String(song.bpm);
        }
    }
    
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
            <defs>
                <filter id="blur50">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="50" />
                </filter>
                <filter id="blur20">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="20" />
                </filter>
                <filter id="shadow">
                    <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#0e1b29" flood-opacity="0.1"/>
                </filter>
                <clipPath id="coverClip">
                    <rect x="0" y="0" width="220" height="220" rx="16"/>
                </clipPath>
                <!-- 网格纹理 -->
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" stroke-width="1" stroke-opacity="0.3"/>
                </pattern>
            </defs>
            
            <!-- 1. 动态背景 (丰富化) -->
            <rect width="${width}" height="${height}" fill="#f1f5f9"/>
            
            <!-- 彩色光斑 -->
            <circle cx="0" cy="0" r="300" fill="${gameColor}" opacity="0.2" filter="url(#blur50)"/>
            <circle cx="${width}" cy="${height}" r="350" fill="#ec4899" opacity="0.15" filter="url(#blur50)"/>
            <circle cx="${width}" cy="0" r="200" fill="#8b5cf6" opacity="0.1" filter="url(#blur50)"/>
            
            <!-- 叠加网格纹理 -->
            <rect width="${width}" height="${height}" fill="url(#grid)"/>
            
            <!-- 全屏模糊封面 -->
            ${coverBase64 ? `
                <image x="-50" y="100" width="${width+100}" height="600" href="${coverBase64}" preserveAspectRatio="xMidYMid slice" opacity="0.08" filter="url(#blur20)"/>
            ` : ''}

            <!-- 2. 主卡片 -->
            <g filter="url(#shadow)">
                <rect x="24" y="24" width="${width-48}" height="${height-48}" rx="24" fill="white" fill-opacity="0.95"/>
            </g>

            <!-- 卡片内容 -->
            <g transform="translate(24, 24)">
                
                <!-- 顶部：随机歌曲标签 -->
                <g transform="translate(${(width-48)/2}, 30)">
                    <rect x="-60" y="-14" width="120" height="28" rx="14" fill="#f8fafc" stroke="#e2e8f0"/>
                    <text x="0" y="5" font-size="12" fill="#64748b" text-anchor="middle" font-weight="bold" letter-spacing="1">随机歌曲</text>
                </g>

                <!-- 游戏 Logo (下移) -->
                <g transform="translate(${(width-48)/2}, 85)">
                    ${gameLogoBase64 ? `
                        <image x="-70" y="-23" width="140" height="46" href="${gameLogoBase64}" preserveAspectRatio="xMidYMid meet"/>
                    ` : `
                        <text x="0" y="10" font-size="28" fill="${gameColor}" font-weight="900" text-anchor="middle" style="font-style: italic;">${escapeXml(gameConfig?.name || song.gameId)}</text>
                    `}
                </g>

                <!-- 中部：大封面 -->
                <g transform="translate(${(width-48)/2 - 110}, 140)">
                    <rect x="8" y="12" width="220" height="220" rx="16" fill="rgba(0,0,0,0.12)"/>
                    ${coverBase64 ? `
                        <g clip-path="url(#coverClip)">
                            <image width="220" height="220" href="${coverBase64}" preserveAspectRatio="xMidYMid slice"/>
                        </g>
                    ` : `
                        <rect width="220" height="220" rx="16" fill="#cbd5e1"/>
                        <text x="110" y="120" font-size="72" fill="#94a3b8" text-anchor="middle">🎵</text>
                    `}
                </g>

                <!-- 歌曲信息 (防止溢出) -->
                <g transform="translate(${(width-48)/2}, 400)" text-anchor="middle">
                    <!-- 标题：限制长度，动态字号 -->
                    <text y="0" font-size="${titleFontSize}" fill="#1e293b" font-weight="900" style="font-family: sans-serif;">${escapeXml(title.substring(0, 30))}${title.length > 30 ? '...' : ''}</text>
                    
                    <!-- 艺术家：限制长度 -->
                    <text y="30" font-size="${artistFontSize}" fill="#64748b" font-weight="500">${escapeXml(artist.substring(0, 40))}${artist.length > 40 ? '...' : ''}</text>
                    
                    <!-- 信息胶囊 -->
                    <g transform="translate(0, 70)">
                        <rect x="-90" y="-16" width="180" height="32" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
                        <line x1="0" y1="-8" x2="0" y2="8" stroke="#cbd5e1" stroke-width="1"/>
                        <text x="-45" y="5" font-size="13" fill="#0ea5e9" text-anchor="middle" font-weight="bold">${escapeXml(bpmText)} BPM</text>
                        <text x="45" y="5" font-size="13" fill="#64748b" text-anchor="middle" font-weight="bold">${escapeXml((song.category || 'Unknown').substring(0, 8))}</text>
                    </g>
                </g>
                
                <!-- 难度展示区域 -->
                <g transform="translate(0, 520)">
                    ${diffBlocks}
                </g>
                
                <!-- 底部信息区 -->
                <g transform="translate(0, 600)">
                    <line x1="32" y1="0" x2="${width-80}" y2="0" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6 6" stroke-linecap="round"/>
                    
                    <!-- 左侧：RHYTHMSYNC Logo + Made by -->
                    <g transform="translate(32, 45)">
                        <!-- Logo 图形 -->
                        <g transform="skewX(-12)">
                            <rect x="0" y="0" width="10" height="22" fill="#22d3ee" />
                            <rect x="14" y="0" width="10" height="22" fill="#ec4899" />
                        </g>
                        <!-- Logo 文字 -->
                        <text x="32" y="16" font-size="20" font-weight="900" style="font-style: italic; letter-spacing: -0.5px;">
                            <tspan fill="#1e293b">RHYTHM</tspan><tspan fill="#06b6d4">SYNC</tspan>
                        </text>
                        
                        <!-- MADE BY DUOGEYU -->
                        <text x="0" y="45" font-size="10" fill="#94a3b8" font-weight="500" letter-spacing="1" text-transform="uppercase">MADE BY DUOGEYU</text>
                    </g>
                    
                    <!-- 右侧：二维码 -->
                    <g transform="translate(${width-48-32-64}, 12)">
                        ${qrCodeBase64 ? `
                            <image width="64" height="64" href="${qrCodeBase64}" opacity="0.9"/>
                        ` : ''}
                    </g>
                </g>
            </g>
        </svg>
    `;
    
    await sharp(Buffer.from(svg)).png().toFile(imagePath);
    console.log(`[单曲图] 生成成功: ${songId}`);
    
    return { imagePath, songId };
}

/**
 * 随机歌曲 API
 * GET /api/random
 * 查询参数:
 *   - game: 游戏ID (可选，不填则随机选择游戏)
 *   - count: 返回数量 (可选，默认1，最大10)
 *   - difficulty: 难度筛选 (可选，如 "Master", "Expert" 等)
 *   - minLevel: 最低等级 (可选，如 "13", "14+")
 *   - maxLevel: 最高等级 (可选)
 *   - image: 是否生成分享图 (可选，仅当 count=1 时有效)
 * 
 * 示例:
 *   /api/random                           - 随机一首任意游戏的歌
 *   /api/random?game=maimai               - 随机一首 maimai 的歌
 *   /api/random?game=chunithm&count=5     - 随机5首 CHUNITHM 的歌
 *   /api/random?difficulty=Master         - 随机一首有 Master 难度的歌
 *   /api/random?game=maimai&minLevel=13   - 随机一首 maimai 13级以上的歌
 *   /api/random?game=maimai&image=true    - 随机一首并生成分享图
 */
app.get('/api/random', async (req, res) => {
    try {
        const { game, count = 1, difficulty, minLevel, maxLevel, image } = req.query;
        const resultCount = Math.min(Math.max(1, parseInt(count) || 1), 10);
        const generateImg = image === 'true' || image === '1';
        
        // 确定游戏
        let targetGames = Object.keys(GAME_CONFIG);
        if (game) {
            if (!GAME_CONFIG[game]) {
                return res.status(400).json({
                    success: false,
                    error: `未知游戏: ${game}`,
                    availableGames: Object.keys(GAME_CONFIG)
                });
            }
            targetGames = [game];
        }
        
        // 获取歌曲
        let allSongs = [];
        for (const gameId of targetGames) {
            try {
                const songs = await fetchGameSongs(gameId);
                allSongs = allSongs.concat(songs);
            } catch (e) {
                console.warn(`[随机] 获取 ${gameId} 失败: ${e.message}`);
            }
        }
        
        if (allSongs.length === 0) {
            return res.status(500).json({ success: false, error: '无法获取歌曲数据' });
        }
        
        // 难度筛选
        if (difficulty) {
            allSongs = allSongs.filter(s => 
                s.charts?.some(c => c.difficulty?.toLowerCase() === difficulty.toLowerCase())
            );
        }
        
        // 等级筛选辅助函数
        const parseLevel = (lvl) => {
            if (!lvl) return 0;
            const str = String(lvl).replace('+', '.5');
            return parseFloat(str) || 0;
        };
        
        // 等级筛选
        if (minLevel || maxLevel) {
            const minLvl = parseLevel(minLevel) || 0;
            const maxLvl = parseLevel(maxLevel) || 99;
            
            allSongs = allSongs.filter(s => {
                const levels = s.levels || s.charts?.map(c => c.level) || [];
                return levels.some(lvl => {
                    const numLvl = parseLevel(lvl);
                    return numLvl >= minLvl && numLvl <= maxLvl;
                });
            });
        }
        
        if (allSongs.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: '没有符合条件的歌曲',
                filters: { game, difficulty, minLevel, maxLevel }
            });
        }
        
        // 随机选择
        const shuffled = allSongs.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, resultCount);
        
        // 格式化输出
        const result = selected.map(s => ({
            gameId: s.gameId,
            gameName: GAME_CONFIG[s.gameId]?.name || s.gameId,
            id: s.id,
            title: s.title,
            artist: s.artist,
            category: s.category,
            version: s.version,
            bpm: s.bpm,
            coverUrl: s.coverUrl,
            type: s.type,
            charts: s.charts || [],
            levels: s.levels || []
        }));
        
        // 生成图片 (仅单曲时)
        let imageUrl = null;
        let songImageId = null;
        if (generateImg && resultCount === 1) {
            try {
                const websiteUrl = getPublicWebBaseUrl(req);
                const { imagePath, songId } = await generateSongImage(result[0], GAME_CONFIG[result[0].gameId], websiteUrl);
                songImageId = songId;
                imageUrl = `http://${req.get('host')}/api/random/image/${songId}`;
            } catch (e) {
                console.error('[随机] 生成图片失败:', e.message);
            }
        }
        
        const response = {
            success: true,
            count: result.length,
            totalPool: allSongs.length,
            filters: { game: game || 'all', difficulty, minLevel, maxLevel },
            songs: resultCount === 1 ? result[0] : result
        };
        
        if (imageUrl) {
            response.imageUrl = imageUrl;
            response.imageId = songImageId;
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('[随机API] 错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取单曲分享图
 * GET /api/random/image/:id
 */
app.get('/api/random/image/:id', (req, res) => {
    const { id } = req.params;
    const imagePath = path.join(SONG_IMAGE_DIR, `${id}.png`);
    
    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: '图片不存在或已过期' });
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    res.set('Content-Type', 'image/png');
    res.set('Content-Length', imageBuffer.length);
    res.send(imageBuffer);
});

/**
 * 游戏曲库查询 API
 * GET /api/songs/:gameId
 * 查询参数:
 *   - page: 页码 (默认1)
 *   - limit: 每页数量 (默认50，最大200)
 *   - search: 搜索关键词 (可选，搜索标题和艺术家)
 *   - category: 分类筛选 (可选)
 *   - difficulty: 难度筛选 (可选)
 *   - minLevel: 最低等级 (可选)
 *   - maxLevel: 最高等级 (可选)
 * 
 * 示例:
 *   /api/songs/maimai                           - 获取 maimai 曲库
 *   /api/songs/chunithm?search=freedom          - 搜索 CHUNITHM 中包含 freedom 的歌
 *   /api/songs/maimai?difficulty=Master&minLevel=14  - maimai 14级以上 Master 谱
 */
app.get('/api/songs/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { page = 1, limit = 50, search, category, difficulty, minLevel, maxLevel } = req.query;
        
        if (!GAME_CONFIG[gameId]) {
            return res.status(400).json({
                success: false,
                error: `未知游戏: ${gameId}`,
                availableGames: Object.keys(GAME_CONFIG)
            });
        }
        
        let songs = await fetchGameSongs(gameId);
        
        // 搜索筛选
        if (search) {
            const query = search.toLowerCase();
            songs = songs.filter(s => 
                (s.title || '').toLowerCase().includes(query) ||
                (s.artist || '').toLowerCase().includes(query)
            );
        }
        
        // 分类筛选
        if (category) {
            songs = songs.filter(s => 
                (s.category || '').toLowerCase().includes(category.toLowerCase())
            );
        }
        
        // 难度筛选
        if (difficulty) {
            songs = songs.filter(s => 
                s.charts?.some(c => c.difficulty?.toLowerCase() === difficulty.toLowerCase())
            );
        }
        
        // 等级筛选
        const parseLevel = (lvl) => {
            if (!lvl) return 0;
            const str = String(lvl).replace('+', '.5');
            return parseFloat(str) || 0;
        };
        
        if (minLevel || maxLevel) {
            const minLvl = parseLevel(minLevel) || 0;
            const maxLvl = parseLevel(maxLevel) || 99;
            
            songs = songs.filter(s => {
                const levels = s.levels || s.charts?.map(c => c.level) || [];
                return levels.some(lvl => {
                    const numLvl = parseLevel(lvl);
                    return numLvl >= minLvl && numLvl <= maxLvl;
                });
            });
        }
        
        // 分页
        const pageNum = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(Math.max(1, parseInt(limit) || 50), 200);
        const totalCount = songs.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const startIndex = (pageNum - 1) * pageSize;
        const paginatedSongs = songs.slice(startIndex, startIndex + pageSize);
        
        res.json({
            success: true,
            gameId,
            gameName: GAME_CONFIG[gameId].name,
            pagination: {
                page: pageNum,
                limit: pageSize,
                totalCount,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1
            },
            filters: { search, category, difficulty, minLevel, maxLevel },
            songs: paginatedSongs
        });
        
    } catch (error) {
        console.error('[曲库API] 错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 跨游戏搜索 API
 * GET /api/search
 * 查询参数:
 *   - q: 搜索关键词 (必填)
 *   - games: 要搜索的游戏，逗号分隔 (可选，默认全部)
 *   - limit: 每个游戏返回的最大数量 (默认10，最大50)
 * 
 * 示例:
 *   /api/search?q=freedom dive            - 在所有游戏中搜索
 *   /api/search?q=初音&games=maimai,chunithm  - 只在指定游戏中搜索
 */
app.get('/api/search', async (req, res) => {
    try {
        const { q, games, limit = 10 } = req.query;
        
        if (!q || q.trim().length < 1) {
            return res.status(400).json({ success: false, error: '缺少搜索关键词 (q 参数)' });
        }
        
        const query = q.toLowerCase().trim();
        const resultLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
        
        // 确定搜索范围
        let targetGames = Object.keys(GAME_CONFIG);
        if (games) {
            const requestedGames = games.split(',').map(g => g.trim()).filter(g => GAME_CONFIG[g]);
            if (requestedGames.length > 0) {
                targetGames = requestedGames;
            }
        }
        
        const results = {};
        let totalMatches = 0;
        
        for (const gameId of targetGames) {
            try {
                const songs = await fetchGameSongs(gameId);
                
                // 使用 fuzzysort 进行模糊搜索
                const fuzzied = fuzzysort.go(query, songs, {
                    keys: ['title', 'artist'],
                    limit: resultLimit,
                    threshold: -10000
                });
                
                if (fuzzied.length > 0) {
                    results[gameId] = {
                        gameName: GAME_CONFIG[gameId].name,
                        count: fuzzied.length,
                        matches: fuzzied.map(r => ({
                            score: r.score,
                            song: {
                                id: r.obj.id,
                                title: r.obj.title,
                                artist: r.obj.artist,
                                category: r.obj.category,
                                coverUrl: r.obj.coverUrl,
                                charts: r.obj.charts || [],
                                levels: r.obj.levels || []
                            }
                        }))
                    };
                    totalMatches += fuzzied.length;
                }
            } catch (e) {
                console.warn(`[搜索] 获取 ${gameId} 失败: ${e.message}`);
            }
        }
        
        res.json({
            success: true,
            query: q,
            totalMatches,
            searchedGames: targetGames,
            results
        });
        
    } catch (error) {
        console.error('[搜索API] 错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 单曲匹配 API (快速检查一首歌在哪些游戏中存在)
 * GET /api/check
 * 查询参数:
 *   - title: 歌曲标题 (必填)
 *   - artist: 艺术家 (可选，提高匹配精度)
 * 
 * 示例:
 *   /api/check?title=FREEDOM DiVE
 *   /api/check?title=千本桜&artist=黒うさP
 */
app.get('/api/check', async (req, res) => {
    try {
        const { title, artist } = req.query;
        
        if (!title || title.trim().length < 1) {
            return res.status(400).json({ success: false, error: '缺少歌曲标题 (title 参数)' });
        }
        
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
        
        const normalizedTitle = normalizeTitle(title);
        const normalizedArtist = artist ? normalizeTitle(artist) : null;
        
        const matches = {};
        let foundInGames = 0;
        
        for (const [gameId, config] of Object.entries(GAME_CONFIG)) {
            try {
                const songs = await fetchGameSongs(gameId);
                
                // 精确匹配优先
                let match = songs.find(s => normalizeTitle(s.title) === normalizedTitle);
                
                // 如果有艺术家，还要匹配艺术家
                if (match && normalizedArtist) {
                    const artistMatch = normalizeTitle(match.artist).includes(normalizedArtist) ||
                                       normalizedArtist.includes(normalizeTitle(match.artist));
                    if (!artistMatch) {
                        // 艺术家不匹配，尝试找更精确的
                        const betterMatch = songs.find(s => 
                            normalizeTitle(s.title) === normalizedTitle &&
                            (normalizeTitle(s.artist).includes(normalizedArtist) ||
                             normalizedArtist.includes(normalizeTitle(s.artist)))
                        );
                        if (betterMatch) match = betterMatch;
                    }
                }
                
                // 如果没有精确匹配，尝试模糊匹配
                if (!match) {
                    const fuzzied = fuzzysort.go(title, songs, {
                        key: 'title',
                        limit: 1,
                        threshold: -5000
                    });
                    if (fuzzied.length > 0 && fuzzied[0].score > -1000) {
                        match = fuzzied[0].obj;
                    }
                }
                
                if (match) {
                    matches[gameId] = {
                        gameName: config.name,
                        found: true,
                        song: {
                            id: match.id,
                            title: match.title,
                            artist: match.artist,
                            category: match.category,
                            coverUrl: match.coverUrl,
                            charts: match.charts || [],
                            levels: match.levels || []
                        }
                    };
                    foundInGames++;
                }
            } catch (e) {
                console.warn(`[检查] 获取 ${gameId} 失败: ${e.message}`);
            }
        }
        
        res.json({
            success: true,
            query: { title, artist },
            foundInGames,
            totalGames: Object.keys(GAME_CONFIG).length,
            matches
        });
        
    } catch (error) {
        console.error('[检查API] 错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * API 文档
 * GET /api/docs
 */
app.get('/api/docs', (req, res) => {
    res.json({
        name: 'Rhythm_Sync API',
        version: '1.0.0',
        description: '音游歌单匹配工具 API，支持 maimai、CHUNITHM、ONGEKI、太鼓の達人 等游戏',
        endpoints: {
            // 基础 API
            'GET /api/health': '健康检查',
            'GET /api/games': '获取支持的游戏列表',
            'GET /api/docs': '本文档',
            
            // 机器人友好 API
            'GET /api/random': {
                description: '随机获取歌曲',
                params: {
                    game: '游戏ID (可选)',
                    count: '返回数量 1-10 (默认1)',
                    difficulty: '难度筛选 (如 Master)',
                    minLevel: '最低等级 (如 13)',
                    maxLevel: '最高等级'
                },
                example: '/api/random?game=maimai&count=3'
            },
            'GET /api/songs/:gameId': {
                description: '查询游戏曲库',
                params: {
                    page: '页码 (默认1)',
                    limit: '每页数量 1-200 (默认50)',
                    search: '搜索关键词',
                    category: '分类筛选',
                    difficulty: '难度筛选',
                    minLevel: '最低等级',
                    maxLevel: '最高等级'
                },
                example: '/api/songs/maimai?search=freedom&difficulty=Master'
            },
            'GET /api/search': {
                description: '跨游戏搜索',
                params: {
                    q: '搜索关键词 (必填)',
                    games: '游戏范围，逗号分隔 (可选)',
                    limit: '每个游戏最大返回数 (默认10)'
                },
                example: '/api/search?q=初音ミク&games=maimai,chunithm'
            },
            'GET /api/check': {
                description: '检查歌曲在哪些游戏中存在',
                params: {
                    title: '歌曲标题 (必填)',
                    artist: '艺术家 (可选)'
                },
                example: '/api/check?title=FREEDOM DiVE'
            },
            
            // 🤖 机器人全流程 API
            'POST /api/bot/query': {
                description: '一站式歌单查询 (机器人专用)',
                body: {
                    input: '歌单链接或用户ID (必填)',
                    playlistId: '歌单ID (当input是用户ID时需要)',
                    siteUrl: '网站地址，用于生成二维码 (可选，默认使用请求来源)',
                    generateImage: '是否生成分享图 (默认true)'
                },
                returns: '完整匹配结果 + 结果页链接 + 分享图URL',
                example: 'POST /api/bot/query { "input": "https://music.163.com/playlist?id=123456" }'
            },
            'GET /api/bot/result/:id': '获取保存的查询结果',
            'GET /api/bot/result/:id/image': '获取结果分享图',
            
            // 歌单匹配 API
            'POST /api/match/start': '开始歌单匹配 (需要歌曲数据)',
            'GET /api/match/stream/:sessionId': '流式获取匹配结果 (SSE)',
            
            // 平台歌单获取
            'GET /api/netease/user/:uid/playlists': '获取网易云用户歌单',
            'GET /api/netease/playlist/:id': '获取网易云歌单详情',
            'GET /api/qqmusic/playlist/:id': '获取QQ音乐歌单',
            'GET /api/bilibili/user/:uid/favlist': '获取B站用户收藏夹',
            
            // 分享功能
            'POST /api/share/create': '创建分享链接',
            'GET /api/share/:shareId': '获取分享数据'
        },
        availableGames: Object.entries(GAME_CONFIG).map(([id, config]) => ({
            id,
            name: config.name,
            shortName: config.shortName
        }))
    });
});

// ============== 机器人全流程 API ==============
const BOT_RESULT_DIR = path.join(__dirname, '.bot_results');
const BOT_RESULT_EXPIRY_DAYS = 7;

// 确保目录存在
if (!fs.existsSync(BOT_RESULT_DIR)) {
    fs.mkdirSync(BOT_RESULT_DIR, { recursive: true });
}

// 清理过期结果
function cleanupExpiredBotResults() {
    const now = Date.now();
    const expiryMs = BOT_RESULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    try {
        const files = fs.readdirSync(BOT_RESULT_DIR);
        let cleaned = 0;
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const filePath = path.join(BOT_RESULT_DIR, file);
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (now - data.createdAt > expiryMs) {
                    fs.unlinkSync(filePath);
                    // 同时删除对应的图片
                    const imgPath = path.join(BOT_RESULT_DIR, 'images', `${file.replace('.json', '')}.png`);
                    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                    cleaned++;
                }
            } catch (e) {
                fs.unlinkSync(filePath);
                cleaned++;
            }
        }
        
        if (cleaned > 0) console.log(`[Bot] 清理了 ${cleaned} 个过期结果`);
    } catch (e) {
        console.error('[Bot] 清理失败:', e.message);
    }
}

setInterval(cleanupExpiredBotResults, 60 * 60 * 1000);
cleanupExpiredBotResults();

/**
 * 机器人一站式查询 API
 * POST /api/bot/query
 * 
 * 支持的输入格式:
 * - 网易云歌单链接: https://music.163.com/playlist?id=xxx
 * - 网易云用户ID: 纯数字
 * - QQ音乐歌单链接: https://y.qq.com/n/ryqq/playlist/xxx
 * - 文本歌曲列表: 多行文本，每行一首歌
 */
app.post('/api/bot/query', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { input, playlistId: specifiedPlaylistId, siteUrl, generateImage = true } = req.body;
        
        if (!input) {
            return res.status(400).json({ success: false, error: '缺少 input 参数' });
        }
        
        console.log(`[Bot] 开始查询: ${input.substring(0, 100)}...`);
        
        // 1. 解析输入
        const parsed = parseInput(input);
        console.log(`[Bot] 解析结果: ${parsed.platform} - ${parsed.type}`);
        
        let userSongs = [];
        let playlist = null;
        
        // 2. 根据平台获取歌曲
        if (parsed.platform === 'text') {
            // 文本导入
            if (parsed.type === 'songlist') {
                userSongs = parsed.songs.map((name, i) => ({
                    id: i,
                    name: name,
                    artists: '',
                    album: '',
                    coverUrl: '',
                    duration: 0
                }));
                playlist = {
                    id: 'text_import',
                    name: `文本导入 (${userSongs.length} 首)`,
                    coverUrl: '',
                    trackCount: userSongs.length,
                    creator: '机器人导入'
                };
            } else if (parsed.type === 'single') {
                userSongs = [{
                    id: 0,
                    name: parsed.query,
                    artists: '',
                    album: '',
                    coverUrl: '',
                    duration: 0
                }];
                playlist = {
                    id: 'text_single',
                    name: parsed.query,
                    coverUrl: '',
                    trackCount: 1,
                    creator: '机器人查询'
                };
            } else {
                return res.status(400).json({ success: false, error: '无法解析输入内容' });
            }
        } else if (parsed.platform === 'netease') {
            // 网易云音乐
            if (parsed.type === 'playlist') {
                // 直接是歌单链接
                const playlistResult = await playlist_detail({ id: parsed.id });
                const playlistInfo = playlistResult.body.playlist;
                
                playlist = {
                    id: parsed.id,
                    name: playlistInfo.name,
                    coverUrl: playlistInfo.coverImgUrl,
                    trackCount: playlistInfo.trackCount,
                    creator: playlistInfo.creator?.nickname || '未知'
                };
                
                // 获取歌曲
                const tracksResult = await playlist_track_all({ id: parsed.id });
                userSongs = tracksResult.body.songs.map(s => ({
                    id: s.id,
                    name: s.name,
                    artists: s.ar?.map(a => a.name).join(', ') || '',
                    album: s.al?.name || '',
                    coverUrl: s.al?.picUrl || '',
                    duration: s.dt || 0
                }));
            } else if (parsed.type === 'user') {
                // 用户ID，需要指定歌单
                if (!specifiedPlaylistId) {
                    // 返回用户的歌单列表让机器人选择
                    const playlistsResult = await user_playlist({ uid: parsed.id });
                    const playlists = playlistsResult.body.playlist.map(p => ({
                        id: p.id,
                        name: p.name,
                        coverUrl: p.coverImgUrl,
                        trackCount: p.trackCount,
                        creator: p.creator?.nickname || '未知'
                    }));
                    
                    return res.json({
                        success: true,
                        needSelectPlaylist: true,
                        playlists,
                        message: '请选择一个歌单，然后在请求中添加 playlistId 参数'
                    });
                }
                
                // 获取指定歌单
                const playlistResult = await playlist_detail({ id: specifiedPlaylistId });
                const playlistInfo = playlistResult.body.playlist;
                
                playlist = {
                    id: specifiedPlaylistId,
                    name: playlistInfo.name,
                    coverUrl: playlistInfo.coverImgUrl,
                    trackCount: playlistInfo.trackCount,
                    creator: playlistInfo.creator?.nickname || '未知'
                };
                
                const tracksResult = await playlist_track_all({ id: specifiedPlaylistId });
                userSongs = tracksResult.body.songs.map(s => ({
                    id: s.id,
                    name: s.name,
                    artists: s.ar?.map(a => a.name).join(', ') || '',
                    album: s.al?.name || '',
                    coverUrl: s.al?.picUrl || '',
                    duration: s.dt || 0
                }));
            }
        } else if (parsed.platform === 'qqmusic') {
            // QQ音乐 - 使用现有的 API
            const qqResult = await axios.get(`https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg`, {
                params: { disstid: parsed.id, format: 'json' },
                headers: { Referer: 'https://y.qq.com/' }
            }).catch(() => null);
            
            // 备用方案：使用内部 API
            if (!qqResult || !qqResult.data) {
                return res.status(400).json({ success: false, error: 'QQ音乐歌单获取失败，请使用网易云链接' });
            }
        } else {
            return res.status(400).json({ 
                success: false, 
                error: `暂不支持该平台: ${parsed.platform}`,
                parsed 
            });
        }
        
        if (userSongs.length === 0) {
            return res.status(400).json({ success: false, error: '未能获取到歌曲' });
        }
        
        console.log(`[Bot] 获取到 ${userSongs.length} 首歌曲，开始匹配...`);
        
        // 3. 进行匹配
        const gameIds = Object.keys(GAME_CONFIG);
        const results = {};
        
        // 准备匹配函数
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
        
        // 并行获取所有游戏数据并匹配
        await Promise.all(gameIds.map(async (gameId) => {
            try {
                const gameSongs = await fetchGameSongs(gameId);
                
                // 建立索引
                const titleMap = new Map();
                gameSongs.forEach(s => {
                    titleMap.set(normalizeTitle(s.title), s);
                    titleMap.set(s.title, s);
                });
                
                const fuse = new Fuse(gameSongs, {
                    keys: ['title', 'artist'],
                    threshold: 0.3,
                    includeScore: true
                });
                
                const matches = [];
                
                for (const userSong of userSongs) {
                    const normalizedUserTitle = normalizeTitle(userSong.name);
                    
                    // 精确匹配
                    let match = titleMap.get(normalizedUserTitle);
                    
                    // 模糊匹配
                    if (!match) {
                        const fuzzyResults = fuse.search(userSong.name, { limit: 1 });
                        if (fuzzyResults.length > 0 && fuzzyResults[0].score < 0.3) {
                            match = fuzzyResults[0].item;
                        }
                    }
                    
                    if (match) {
                        // 判断匹配标签
                        const tags = [];
                        const isTitleExact = normalizeTitle(match.title) === normalizedUserTitle;
                        const userArtistNorm = normalizeTitle(userSong.artists);
                        const matchArtistNorm = normalizeTitle(match.artist);
                        const isArtistSame = userArtistNorm && matchArtistNorm && 
                            (userArtistNorm.includes(matchArtistNorm) || matchArtistNorm.includes(userArtistNorm));
                        
                        if (isTitleExact && isArtistSame) tags.push('perfect_match');
                        else if (isArtistSame) tags.push('same_artist');
                        else if (isTitleExact) tags.push('different_artist');
                        else tags.push('similar_artist');
                        
                        matches.push({
                            userSong: {
                                id: userSong.id,
                                name: userSong.name,
                                artists: userSong.artists,
                                coverUrl: userSong.coverUrl
                            },
                            arcadeSong: {
                                id: match.id,
                                title: match.title,
                                artist: match.artist,
                                coverUrl: match.coverUrl,
                                category: match.category,
                                charts: match.charts,
                                levels: match.levels
                            },
                            score: isTitleExact ? 100 : 80,
                            matchType: isTitleExact ? 'exact' : 'fuzzy',
                            tags
                        });
                    }
                }
                
                results[gameId] = {
                    config: GAME_CONFIG[gameId],
                    matches
                };
            } catch (e) {
                console.error(`[Bot] ${gameId} 匹配失败:`, e.message);
                results[gameId] = {
                    config: GAME_CONFIG[gameId],
                    matches: [],
                    error: e.message
                };
            }
        }));
        
        // 4. 计算统计
        let totalMatches = 0;
        const gameSummary = {};
        for (const [gameId, data] of Object.entries(results)) {
            gameSummary[gameId] = {
                name: data.config.name,
                shortName: data.config.shortName,
                matchCount: data.matches.length
            };
            totalMatches = Math.max(totalMatches, data.matches.length);
        }
        
        const coveragePercent = Math.round((totalMatches / userSongs.length) * 100);
        
        // 5. 保存结果
        const resultId = generateShareId();
        const resultData = {
            id: resultId,
            playlist,
            results,
            userSongCount: userSongs.length,
            coveragePercent,
            gameSummary,
            createdAt: Date.now(),
            expiresAt: Date.now() + BOT_RESULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        };
        
        const resultPath = path.join(BOT_RESULT_DIR, `${resultId}.json`);
        fs.writeFileSync(resultPath, JSON.stringify(resultData, null, 2));
        
        // 6. 生成结果页 URL
        const baseUrl = siteUrl || `http://${req.get('host').replace(':3002', ':5188')}`;
        const resultUrl = `${baseUrl}/#/result/${resultId}`;
        
        // 7. 生成分享图 (如果需要)
        let imageUrl = null;
        if (generateImage) {
            try {
                const imagePath = await generateBotResultImage(resultId, resultData, resultUrl);
                imageUrl = `http://${req.get('host')}/api/bot/result/${resultId}/image`;
            } catch (e) {
                console.error('[Bot] 生成图片失败:', e.message);
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[Bot] 查询完成: ${resultId} | ${userSongs.length}首 → ${totalMatches}匹配 | ${duration}ms`);
        
        res.json({
            success: true,
            resultId,
            resultUrl,
            imageUrl,
            playlist: {
                name: playlist.name,
                trackCount: playlist.trackCount,
                creator: playlist.creator
            },
            summary: {
                totalSongs: userSongs.length,
                maxMatches: totalMatches,
                coveragePercent,
                games: gameSummary
            },
            // 简化版结果 (前3个游戏的前5首)
            preview: Object.fromEntries(
                Object.entries(results)
                    .slice(0, 3)
                    .map(([gameId, data]) => [
                        gameId,
                        {
                            name: data.config.shortName,
                            count: data.matches.length,
                            top5: data.matches.slice(0, 5).map(m => ({
                                title: m.arcadeSong.title,
                                artist: m.arcadeSong.artist
                            }))
                        }
                    ])
            ),
            expiresAt: resultData.expiresAt,
            queryTime: duration
        });
        
    } catch (error) {
        console.error('[Bot] 查询失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取机器人查询结果
 * GET /api/bot/result/:id
 */
app.get('/api/bot/result/:id', (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(BOT_RESULT_DIR, `${id}.json`);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '结果不存在或已过期' });
        }
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        if (Date.now() > data.expiresAt) {
            fs.unlinkSync(filePath);
            return res.status(404).json({ success: false, error: '结果已过期' });
        }
        
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取机器人结果分享图
 * GET /api/bot/result/:id/image
 */
app.get('/api/bot/result/:id/image', async (req, res) => {
    try {
        const { id } = req.params;
        const imagePath = path.join(BOT_RESULT_DIR, 'images', `${id}.png`);
        
        if (!fs.existsSync(imagePath)) {
            // 尝试生成
            const dataPath = path.join(BOT_RESULT_DIR, `${id}.json`);
            if (!fs.existsSync(dataPath)) {
                return res.status(404).json({ error: '结果不存在' });
            }
            
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            const baseUrl = `http://${req.get('host').replace(':3002', ':5188')}`;
            const resultUrl = `${baseUrl}/#/result/${id}`;
            
            await generateBotResultImage(id, data, resultUrl);
        }
        
        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            res.set('Content-Type', 'image/png');
            res.set('Content-Length', imageBuffer.length);
            res.send(imageBuffer);
        } else {
            res.status(500).json({ error: '图片生成失败' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 生成机器人结果分享图
 */
async function generateBotResultImage(resultId, data, resultUrl) {
    const imagesDir = path.join(BOT_RESULT_DIR, 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const imagePath = path.join(imagesDir, `${resultId}.png`);
    
    if (fs.existsSync(imagePath)) {
        return imagePath;
    }
    
    const QRCode = require('qrcode');
    
    // 生成二维码
    const qrDataUrl = await QRCode.toDataURL(resultUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#1e293b', light: '#ffffff' }
    });
    
    // 计算各游戏匹配数
    const gameResults = Object.entries(data.results || {})
        .map(([id, r]) => ({
            id,
            name: r.config?.shortName || id,
            count: r.matches?.length || 0,
            color: r.config?.color || '#888'
        }))
        .sort((a, b) => b.count - a.count);
    
    const maxMatches = Math.max(...gameResults.map(g => g.count), 1);
    const totalSongs = data.userSongCount || data.playlist?.trackCount || 0;
    const coveragePercent = data.coveragePercent || 0;
    
    // 生成 SVG 图片
    const width = 480;
    const height = 640;
    
    const gameBars = gameResults.map((g, i) => {
        const barWidth = Math.max(10, (g.count / maxMatches) * 280);
        const y = 280 + i * 44;
        return `
            <rect x="140" y="${y}" width="${barWidth}" height="32" rx="6" fill="${g.color}" opacity="0.8"/>
            <text x="130" y="${y + 22}" font-size="14" fill="#475569" text-anchor="end" font-weight="600">${g.name}</text>
            <text x="${145 + barWidth + 8}" y="${y + 22}" font-size="14" fill="#1e293b" font-weight="bold">${g.count}</text>
        `;
    }).join('');
    
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#f8fafc"/>
                    <stop offset="100%" style="stop-color:#e2e8f0"/>
                </linearGradient>
                <linearGradient id="header" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#22d3ee"/>
                    <stop offset="100%" style="stop-color:#ec4899"/>
                </linearGradient>
            </defs>
            
            <!-- Background -->
            <rect width="${width}" height="${height}" fill="url(#bg)"/>
            
            <!-- Header -->
            <rect width="${width}" height="80" fill="url(#header)"/>
            <text x="24" y="35" font-size="24" fill="white" font-weight="900" font-style="italic">RHYTHMSYNC</text>
            <text x="24" y="58" font-size="13" fill="rgba(255,255,255,0.9)">音游歌单匹配结果</text>
            
            <!-- Playlist Info -->
            <text x="24" y="115" font-size="18" fill="#1e293b" font-weight="bold">${escapeXml(data.playlist?.name || '歌单')}</text>
            <text x="24" y="140" font-size="13" fill="#64748b">${totalSongs} 首歌曲 · 创建者: ${escapeXml(data.playlist?.creator || '未知')}</text>
            
            <!-- Stats -->
            <rect x="24" y="160" width="200" height="90" rx="12" fill="white" opacity="0.8"/>
            <text x="44" y="190" font-size="13" fill="#64748b">最高匹配</text>
            <text x="44" y="220" font-size="32" fill="#0891b2" font-weight="900">${maxMatches}</text>
            <text x="44" y="240" font-size="12" fill="#94a3b8">/ ${totalSongs} 首</text>
            
            <rect x="256" y="160" width="200" height="90" rx="12" fill="white" opacity="0.8"/>
            <text x="276" y="190" font-size="13" fill="#64748b">覆盖率</text>
            <text x="276" y="220" font-size="32" fill="#ec4899" font-weight="900">${coveragePercent}%</text>
            <text x="276" y="240" font-size="12" fill="#94a3b8">音游浓度</text>
            
            <!-- Game Results -->
            ${gameBars}
            
            <!-- QR Code -->
            <rect x="140" y="${height - 170}" width="200" height="150" rx="12" fill="white"/>
            <image x="165" y="${height - 160}" width="150" height="110" href="${qrDataUrl}"/>
            <text x="240" y="${height - 35}" font-size="11" fill="#64748b" text-anchor="middle">扫码查看完整结果</text>
            
            <!-- Footer -->
            <text x="${width - 24}" y="${height - 16}" font-size="10" fill="#94a3b8" text-anchor="end">有效期7天 · ID: ${resultId}</text>
        </svg>
    `;
    
    // 转换为 PNG
    await sharp(Buffer.from(svg))
        .png()
        .toFile(imagePath);
    
    console.log(`[Bot] 生成分享图: ${imagePath}`);
    return imagePath;
}

// XML 转义函数
function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ============== 管理 API ==============

// 本地访问检查中间件
function localOnly(req, res, next) {
    const ip = getClientIp(req);
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || 
                    ip === '::ffff:127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.');
    
    if (!isLocal) {
        console.log(`[安全] 拒绝非本地访问管理 API: ${ip}`);
        return res.status(403).json({ 
            success: false, 
            error: '管理 API 仅限本地访问',
            yourIp: ip
        });
    }
    next();
}

// 静态文件服务（管理页面也限制本地访问）
app.use('/admin', localOnly, express.static(path.join(__dirname, 'public')));

// 所有管理 API 都需要本地访问
app.use('/api/admin', localOnly);

// 获取当前配置
app.get('/api/admin/config', (req, res) => {
    res.json({
        success: true,
        games: GAMES,
        config: GAME_CONFIG,
        selections: activeSelections
    });
});

// 获取所有可用数据源
app.get('/api/admin/sources', (req, res) => {
    // 返回每个游戏的可用数据源列表
    const sourcesInfo = {};
    for (const [gameId, sources] of Object.entries(DATA_SOURCES)) {
        sourcesInfo[gameId] = {
            game: GAMES[gameId],
            activeSource: activeSelections[gameId],
            availableSources: Object.values(sources).map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                isActive: s.id === activeSelections[gameId]
            }))
        };
    }
    res.json({ success: true, sources: sourcesInfo });
});

// 切换某个游戏的数据源
app.post('/api/admin/switch-source', (req, res) => {
    const { gameId, sourceId } = req.body;
    
    if (!gameId || !sourceId) {
        return res.status(400).json({ 
            success: false, 
            error: '缺少 gameId 或 sourceId'
        });
    }
    
    const result = switchGameSource(gameId, sourceId);
    
    if (result.success) {
        console.log(`[管理] 切换数据源: ${GAMES[gameId]?.shortName} -> ${result.sourceName}`);
    }
    
    res.json(result);
});

// 批量切换数据源（快速预设）
app.post('/api/admin/apply-preset', (req, res) => {
    const { preset } = req.body;
    
    // 预定义的快速预设
    const QUICK_PRESETS = {
        'default': {
            'maimai': 'diving-fish',
            'maimai-jp': 'otoge-jp',
            'maimai-cn': 'crazykid',
            'chunithm': 'diving-fish',
            'chunithm-jp': 'otoge-jp',
            'ongeki': 'otoge-jp',
            'taiko': 'taikowiki'
        },
        'otoge-jp': {
            'maimai': 'diving-fish',
            'maimai-jp': 'otoge-jp',
            'maimai-cn': 'crazykid',
            'chunithm': 'diving-fish',
            'chunithm-jp': 'otoge-jp',
            'ongeki': 'otoge-jp',
            'taiko': 'taikowiki'
        },
        'otoge-intl': {
            'maimai': 'otoge-intl',
            'maimai-jp': 'otoge-jp',
            'maimai-cn': 'crazykid',
            'chunithm': 'otoge-intl',
            'chunithm-jp': 'otoge-jp',
            'ongeki': 'otoge-jp',
            'taiko': 'taikowiki'
        }
    };
    
    if (!preset || !QUICK_PRESETS[preset]) {
        return res.status(400).json({
            success: false,
            error: `无效预设: ${preset}`,
            availablePresets: Object.keys(QUICK_PRESETS)
        });
    }
    
    const changes = [];
    for (const [gameId, sourceId] of Object.entries(QUICK_PRESETS[preset])) {
        if (activeSelections[gameId] !== sourceId && DATA_SOURCES[gameId]?.[sourceId]) {
            const oldSource = activeSelections[gameId];
            activeSelections[gameId] = sourceId;
            changes.push({ gameId, from: oldSource, to: sourceId });
        }
    }
    
    GAME_CONFIG = buildGameConfig();
    saveActiveConfig();
    
    console.log(`[管理] 应用预设: ${preset}, 变更 ${changes.length} 项`);
    
    res.json({
        success: true,
        preset,
        changes,
        config: GAME_CONFIG
    });
});

// 获取缓存状态
app.get('/api/admin/cache-status', (req, res) => {
    try {
        const cacheFiles = [];
        
        if (fs.existsSync(CACHE_DIR)) {
            const files = fs.readdirSync(CACHE_DIR);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(CACHE_DIR, file);
                    const stats = fs.statSync(filePath);
                    const gameId = file.replace('.json', '');
                    
                    try {
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        const age = Date.now() - data.timestamp;
                        const isExpired = age > CACHE_DURATION;
                        
                        cacheFiles.push({
                            gameId,
                            songCount: data.songs?.length || 0,
                            timestamp: data.timestamp,
                            age: formatAge(age),
                            isExpired,
                            size: (stats.size / 1024).toFixed(1) + ' KB'
                        });
                    } catch (e) {
                        cacheFiles.push({
                            gameId,
                            error: '无法读取',
                            size: (stats.size / 1024).toFixed(1) + ' KB'
                        });
                    }
                }
            }
        }
        
        res.json({ success: true, cacheFiles, cacheDir: CACHE_DIR });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 格式化时间
function formatAge(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}小时${minutes}分钟前`;
    return `${minutes}分钟前`;
}

// 清除缓存
app.post('/api/admin/clear-cache', (req, res) => {
    const { gameId } = req.body;
    
    try {
        if (gameId) {
            // 清除指定游戏缓存
            const filePath = path.join(CACHE_DIR, `${gameId}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[管理] 已清除缓存: ${gameId}`);
                res.json({ success: true, message: `已清除 ${gameId} 缓存` });
            } else {
                res.json({ success: true, message: `${gameId} 无缓存` });
            }
        } else {
            // 清除所有缓存
            if (fs.existsSync(CACHE_DIR)) {
                const files = fs.readdirSync(CACHE_DIR);
                let count = 0;
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        fs.unlinkSync(path.join(CACHE_DIR, file));
                        count++;
                    }
                }
                console.log(`[管理] 已清除所有缓存 (${count}个文件)`);
                res.json({ success: true, message: `已清除 ${count} 个缓存文件` });
            } else {
                res.json({ success: true, message: '无缓存目录' });
            }
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 重新加载配置
app.post('/api/admin/reload-config', (req, res) => {
    loadActiveConfig();
    res.json({ 
        success: true, 
        message: '配置已重新加载',
        selections: activeSelections,
        config: GAME_CONFIG
    });
});

// 获取最近日志（增强版，支持分页和 IP 归属地）
app.get('/api/admin/recent-logs', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200); // 默认50条，最多200条
        const page = parseInt(req.query.page) || 1;
        const withLocation = req.query.location !== 'false'; // 默认查询归属地
        
        const logs = [];
        let allFiles = [];
        
        if (fs.existsSync(LOG_DIR)) {
            allFiles = fs.readdirSync(LOG_DIR)
                .filter(f => f.startsWith('query_') && f.endsWith('.json'))
                .sort((a, b) => b.localeCompare(a)); // 按文件名倒序（最新的在前）
        }
        
        const total = allFiles.length;
        const startIdx = (page - 1) * limit;
        const files = allFiles.slice(startIdx, startIdx + limit);
        
        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(LOG_DIR, file), 'utf8'));
                
                // 查询 IP 归属地
                if (withLocation && data.clientIp) {
                    data.location = await getIpLocation(data.clientIp);
                }
                
                logs.push(data);
            } catch (e) {
                // 跳过无法解析的文件
            }
        }
        
        res.json({ 
            success: true, 
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取访问统计
app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = {
            totalQueries: 0,
            todayQueries: 0,
            uniqueIps: new Set(),
            uniqueUids: new Set(),
            todayIps: new Set(),
            recentHours: {},  // 最近24小时每小时的访问量
            topIps: {},       // IP 访问排行
            topUids: {},      // UID 访问排行
            gameStats: {}     // 各游戏匹配统计
        };
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const last24h = now.getTime() - 24 * 60 * 60 * 1000;
        
        // 初始化最近24小时的统计
        for (let i = 0; i < 24; i++) {
            const hour = new Date(last24h + i * 60 * 60 * 1000);
            const key = `${hour.getHours().toString().padStart(2, '0')}:00`;
            stats.recentHours[key] = 0;
        }
        
        if (fs.existsSync(LOG_DIR)) {
            const files = fs.readdirSync(LOG_DIR)
                .filter(f => f.startsWith('query_') && f.endsWith('.json'));
            
            for (const file of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(LOG_DIR, file), 'utf8'));
                    const logTime = new Date(data.timestamp).getTime();
                    
                    stats.totalQueries++;
                    
                    // 统计唯一 IP
                    if (data.clientIp) {
                        stats.uniqueIps.add(data.clientIp);
                        stats.topIps[data.clientIp] = (stats.topIps[data.clientIp] || 0) + 1;
                    }
                    
                    // 统计唯一 UID
                    if (data.neteaseUid && data.neteaseUid !== 'text_import') {
                        stats.uniqueUids.add(data.neteaseUid);
                        stats.topUids[data.neteaseUid] = (stats.topUids[data.neteaseUid] || 0) + 1;
                    }
                    
                    // 今日统计
                    if (logTime >= todayStart) {
                        stats.todayQueries++;
                        if (data.clientIp) stats.todayIps.add(data.clientIp);
                    }
                    
                    // 最近24小时统计
                    if (logTime >= last24h) {
                        const hour = new Date(logTime);
                        const key = `${hour.getHours().toString().padStart(2, '0')}:00`;
                        if (stats.recentHours[key] !== undefined) {
                            stats.recentHours[key]++;
                        }
                    }
                    
                    // 游戏匹配统计
                    if (data.matchResults) {
                        for (const [gameId, result] of Object.entries(data.matchResults)) {
                            if (!stats.gameStats[gameId]) {
                                stats.gameStats[gameId] = { queries: 0, totalMatches: 0 };
                            }
                            stats.gameStats[gameId].queries++;
                            stats.gameStats[gameId].totalMatches += result.matchCount || 0;
                        }
                    }
                } catch (e) {
                    // 跳过无法解析的文件
                }
            }
        }
        
        // 获取 Top IP 的归属地
        const topIpsList = Object.entries(stats.topIps)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        const topIpsWithLocation = [];
        for (const [ip, count] of topIpsList) {
            const location = await getIpLocation(ip);
            topIpsWithLocation.push({
                ip,
                count,
                location: `${location.country} ${location.region} ${location.city}`.trim(),
                isp: location.isp
            });
        }
        
        res.json({
            success: true,
            stats: {
                totalQueries: stats.totalQueries,
                todayQueries: stats.todayQueries,
                uniqueIps: stats.uniqueIps.size,
                uniqueUids: stats.uniqueUids.size,
                todayIps: stats.todayIps.size,
                recentHours: stats.recentHours,
                topIps: topIpsWithLocation,
                topUids: Object.entries(stats.topUids)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([uid, count]) => ({ uid, count })),
                gameStats: stats.gameStats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 查询单个 IP 归属地
app.get('/api/admin/ip-location/:ip', async (req, res) => {
    try {
        const location = await getIpLocation(req.params.ip);
        res.json({ success: true, ip: req.params.ip, location });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 预取数据（提前加载缓存）
app.post('/api/admin/prefetch', async (req, res) => {
    const { gameIds } = req.body;
    const targetGames = gameIds || Object.keys(GAME_CONFIG);
    
    console.log(`[管理] 开始预取数据: ${targetGames.join(', ')}`);
    
    const results = {};
    
    for (const gameId of targetGames) {
        try {
            const songs = await fetchGameSongs(gameId);
            results[gameId] = { success: true, songCount: songs.length };
        } catch (error) {
            results[gameId] = { success: false, error: error.message };
        }
    }
    
    res.json({ success: true, results });
});

// ============== 分享结果存储系统 ==============
const SHARE_DATA_DIR = path.join(__dirname, '.shares');
const SHARE_EXPIRY_DAYS = 3;

// 确保分享数据目录存在
if (!fs.existsSync(SHARE_DATA_DIR)) {
    fs.mkdirSync(SHARE_DATA_DIR, { recursive: true });
}

// 生成短 ID
function generateShareId() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// 清理过期分享数据
function cleanupExpiredShares() {
    const now = Date.now();
    const expiryMs = SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    try {
        const files = fs.readdirSync(SHARE_DATA_DIR);
        let cleaned = 0;
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const filePath = path.join(SHARE_DATA_DIR, file);
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (now - data.createdAt > expiryMs) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            } catch (e) {
                // 文件损坏，删除
                fs.unlinkSync(filePath);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[分享] 清理了 ${cleaned} 个过期分享`);
        }
    } catch (e) {
        console.error('[分享] 清理失败:', e.message);
    }
}

// 每小时清理一次过期分享
setInterval(cleanupExpiredShares, 60 * 60 * 1000);
cleanupExpiredShares(); // 启动时也清理一次

// ============== AI 锐评 API ==============

// AI API 速率限制
const AI_RATE_LIMIT = {
    windowMs: 60 * 1000, // 1分钟窗口
    maxRequests: 5, // 每个IP每分钟最多5次
    requests: new Map() // IP -> { count, resetTime }
};

// 检查速率限制
function checkAIRateLimit(ip) {
    const now = Date.now();
    const record = AI_RATE_LIMIT.requests.get(ip);
    
    if (!record || now > record.resetTime) {
        // 新窗口
        AI_RATE_LIMIT.requests.set(ip, {
            count: 1,
            resetTime: now + AI_RATE_LIMIT.windowMs
        });
        return { allowed: true, remaining: AI_RATE_LIMIT.maxRequests - 1 };
    }
    
    if (record.count >= AI_RATE_LIMIT.maxRequests) {
        const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
        return { allowed: false, remaining: 0, waitSeconds };
    }
    
    record.count++;
    return { allowed: true, remaining: AI_RATE_LIMIT.maxRequests - record.count };
}

// 每分钟清理过期的速率限制记录
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of AI_RATE_LIMIT.requests) {
        if (now > record.resetTime) {
            AI_RATE_LIMIT.requests.delete(ip);
        }
    }
}, 60 * 1000);

// 备用模板（API 失败时使用）
const FALLBACK_COMMENTS = {
    legendary: '传说中的音游DNA觉醒了！🔥 这份歌单简直是街机音游曲库的翻版啊！',
    master: '优秀的音游品味！⭐ 你的歌单里藏着满满的音游情怀',
    expert: '不错哦！🎵 你的歌单与音游有不少重合，是潜力股！',
    advanced: '有潜力！🎮 你的歌单里有一些音游经典曲目',
    beginner: '欢迎来到音游的世界！🌱 虽然重合度不高，但每个传奇都是从这里开始的',
};

// 获取浓度等级
function getConcentrationLevel(coveragePercent) {
    if (coveragePercent >= 80) return 'legendary';
    if (coveragePercent >= 60) return 'master';
    if (coveragePercent >= 40) return 'expert';
    if (coveragePercent >= 20) return 'advanced';
    return 'beginner';
}

// 调用硅基流动 AI API 生成锐评
async function generateAIComment(playlistName, trackCount, coveragePercent, gameSummary, topGames, matchedSongs) {
    const level = getConcentrationLevel(coveragePercent);
    const levelNames = {
        legendary: '传说级',
        master: '大师级', 
        expert: '专家级',
        advanced: '进阶级',
        beginner: '入门级'
    };
    
    // 构建游戏匹配详情
    const gameDetails = topGames && topGames.length > 0 
        ? topGames.filter(g => g.count > 0).map(g => `${g.name}: ${g.count}首`).join('、')
        : gameSummary;
    
    // 构建歌曲列表（最多展示10首）
    const songListText = matchedSongs && matchedSongs.length > 0
        ? `\n- 部分匹配歌曲：${matchedSongs.slice(0, 10).join('、')}${matchedSongs.length > 10 ? '等' : ''}`
        : '';

    const prompt = `你是一个说话一针见血的音游（街机音乐游戏）玩家，擅长用网络流行语。

用户的歌单「${playlistName}」（共${trackCount}首歌）与街机音游曲库进行了匹配：
- 覆盖率（音游浓度）：${coveragePercent}%
- 浓度等级：${levelNames[level]}
- 匹配详情：${gameDetails}${songListText}

请根据以上信息，生成以下内容：
1. **锐评**：3句话，语气毒舌一针见血，像朋友间的调侃。
2. **称号**：给这位玩家起一个简短的称号（4-6字，如“音游大神”、“隐藏触手”等）。
3. **代表歌曲**：从匹配歌曲中选出3首最具代表性或知名度的歌曲（直接返回歌名）。

请直接以纯 JSON 格式输出，不要包含 Markdown 格式标记（如 \`\`\`json）：
{
  "comment": "锐评内容",
  "title": "称号",
  "songs": ["歌曲1", "歌曲2", "歌曲3"]
}`;

    const logDebug = (msg) => {
        const time = new Date().toISOString();
        fs.appendFileSync(path.join(__dirname, 'ai_debug.log'), `[${time}] ${msg}\n`);
    };

    if (!SILICONFLOW_API_KEY) {
        return {
            comment: FALLBACK_COMMENTS[level],
            title: levelNames[level],
            songs: []
        };
    }

    try {
        logDebug(`Requesting AI: ${SILICONFLOW_MODEL}`);
        const response = await axios.post(SILICONFLOW_API_URL, {
            model: SILICONFLOW_MODEL,
            messages: [
                { role: 'user', content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.9,
            top_p: 0.9,
        }, {
            headers: {
                'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000 // 15秒超时
        });

        const content = response.data?.choices?.[0]?.message?.content;
        logDebug(`AI Response: ${content}`);

        if (content) {
            // 清理可能的 Markdown 标记
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                const result = JSON.parse(cleanContent);
                return {
                    comment: result.comment || FALLBACK_COMMENTS[level],
                    title: result.title || levelNames[level],
                    songs: Array.isArray(result.songs) ? result.songs.slice(0, 3) : []
                };
            } catch (e) {
                console.error('[AI 锐评] JSON 解析失败:', e, content);
                logDebug(`JSON Parse Error: ${e.message}`);
                // 降级：尝试直接作为评论文本
                return {
                    comment: cleanContent,
                    title: levelNames[level],
                    songs: []
                };
            }
        }
        
        return {
            comment: FALLBACK_COMMENTS[level],
            title: levelNames[level],
            songs: []
        };
    } catch (error) {
        console.error('[AI 锐评] API 调用失败:', error.message);
        logDebug(`API Error: ${error.message} - ${JSON.stringify(error.response?.data || {})}`);
        if (error.response) {
            console.error('API 响应:', error.response.data);
        }
        return {
            comment: FALLBACK_COMMENTS[level],
            title: levelNames[level],
            songs: []
        };
    }
}

// AI 锐评 API 端点（带速率限制）
app.post('/api/ai/comment', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    // 检查速率限制
    const rateCheck = checkAIRateLimit(clientIp);
    if (!rateCheck.allowed) {
        console.log(`[AI 锐评] 速率限制: ${clientIp}, 需等待 ${rateCheck.waitSeconds}秒`);
        return res.status(429).json({
            success: false,
            error: `请求太频繁，请 ${rateCheck.waitSeconds} 秒后再试`,
            retryAfter: rateCheck.waitSeconds
        });
    }
    
    try {
        const { playlistName, trackCount, coveragePercent, gameSummary, topGames, matchedSongs } = req.body;
        
        console.log(`[AI 锐评] 生成中... 歌单: ${playlistName}, 浓度: ${coveragePercent}%, 歌曲数: ${matchedSongs?.length || 0}`);
        
        const aiResult = await generateAIComment(playlistName, trackCount, coveragePercent, gameSummary, topGames, matchedSongs);
        const level = getConcentrationLevel(coveragePercent);
        
        console.log(`[AI 锐评] 生成成功:`, aiResult);
        
        res.json({
            success: true,
            comment: aiResult.comment,
            title: aiResult.title,
            songs: aiResult.songs,
            level,
            remaining: rateCheck.remaining
        });
    } catch (error) {
        console.error('[AI 锐评] 生成失败:', error);
        const level = getConcentrationLevel(req.body?.coveragePercent || 0);
        res.json({
            success: false,
            comment: FALLBACK_COMMENTS[level],
            title: '',
            songs: [],
            level,
            error: error.message
        });
    }
});

// 确保分享图片目录存在
const SHARE_IMAGES_DIR = path.join(__dirname, '.shares/images');
if (!fs.existsSync(SHARE_IMAGES_DIR)) {
    fs.mkdirSync(SHARE_IMAGES_DIR, { recursive: true });
}

// 启动浏览器实例
let browserInstance = null;
async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: 'new'
        });
    }
    return browserInstance;
}

// ============== 抗压缩隐水印功能 ==============
// 在图片底部居中嵌入极淡的视觉水印（肉眼不可见，调整对比度后可见）
async function embedVisualWatermark(imagePath, watermarkInfo) {
    try {
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        const { width, height } = metadata;
        
        // 水印内容 - 多行显示更多信息
        const { shareId, playlist, coverage, created, totalMatches } = watermarkInfo;
        const line1 = `RHYTHMSYNC · ID: ${shareId}`;
        const line2 = `${playlist} · ${coverage}% · ${totalMatches}曲`;
        const line3 = `Generated: ${created}`;
        
        const fontSize = Math.max(10, Math.floor(width / 40));
        const lineHeight = fontSize * 1.4;
        const bottomPadding = 15;
        
        // 底部居中的水印 SVG
        const watermarkSvg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <style>
                    text { 
                        font-family: 'Consolas', 'Monaco', monospace; 
                        font-weight: normal;
                        text-anchor: middle;
                    }
                </style>
                <text x="${width / 2}" y="${height - bottomPadding - lineHeight * 2}" font-size="${fontSize}" fill="rgba(128,128,128,0.02)">${line1}</text>
                <text x="${width / 2}" y="${height - bottomPadding - lineHeight}" font-size="${fontSize}" fill="rgba(128,128,128,0.02)">${line2}</text>
                <text x="${width / 2}" y="${height - bottomPadding}" font-size="${fontSize - 1}" fill="rgba(128,128,128,0.015)">${line3}</text>
            </svg>
        `;
        
        // 将水印叠加到图片上
        await sharp(imagePath)
            .composite([{
                input: Buffer.from(watermarkSvg),
                top: 0,
                left: 0,
                blend: 'over'
            }])
            .png()
            .toFile(imagePath + '.tmp');
        
        // 替换原文件
        fs.renameSync(imagePath + '.tmp', imagePath);
        
        console.log(`[水印] 视觉水印嵌入成功: ${shareId}`);
    } catch (error) {
        console.error('[水印] 嵌入失败:', error.message);
    }
}

// 生成分享图片
async function generateShareImage(shareId) {
    const imagePath = path.join(SHARE_IMAGES_DIR, `${shareId}.png`);
    
    // 如果图片已存在，直接返回
    if (fs.existsSync(imagePath)) {
        return imagePath;
    }
    
    // 读取分享数据用于水印
    const shareDataPath = path.join(SHARE_DATA_DIR, `${shareId}.json`);
    let shareData = null;
    if (fs.existsSync(shareDataPath)) {
        shareData = JSON.parse(fs.readFileSync(shareDataPath, 'utf-8'));
    }
    
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        // 设置视口大小 (根据设计稿调整)
        await page.setViewport({ width: 480, height: 800, deviceScaleFactor: 2 });
        
        // 访问分享页面的渲染模式 (需要前端支持 /#/share/:id?render=true 路由，仅显示卡片)
        const renderUrl = `http://localhost:5188/#/share/${shareId}?render=true`;
        console.log(`[分享图] 正在渲染: ${renderUrl}`);
        
        await page.goto(renderUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // 等待内容加载完成 (可以通过等待特定选择器)
        const selector = '[data-share-card]';
        await page.waitForSelector(selector, { timeout: 10000 });
        
        // 获取元素并截图
        const element = await page.$(selector);
        if (!element) throw new Error('找不到分享卡片元素');
        
        await element.screenshot({
            path: imagePath,
            omitBackground: true
        });
        
        console.log(`[分享图] 生成成功: ${imagePath}`);
        
        // 嵌入视觉隐水印（极淡，调整对比度后可见）
        if (shareData) {
            // 计算总匹配数
            let totalMatches = 0;
            if (shareData.results) {
                for (const gameData of Object.values(shareData.results)) {
                    totalMatches += gameData.totalMatches || gameData.matches?.length || 0;
                }
            }
            
            const watermarkInfo = {
                shareId,
                playlist: shareData.playlist?.name || 'Unknown',
                coverage: shareData.coveragePercent || 0,
                created: new Date(shareData.createdAt).toISOString().replace('T', ' ').substring(0, 19),
                totalMatches
            };
            await embedVisualWatermark(imagePath, watermarkInfo);
        }
        
        return imagePath;
    } catch (error) {
        console.error('[分享图] 生成失败:', error);
        throw error;
    } finally {
        await page.close();
    }
}

// ============== 分享 API ==============
// 获取分享图片
app.get('/api/share/:id/image', async (req, res) => {
    const { id } = req.params;
    
    // 检查分享是否存在
    const sharePath = path.join(SHARE_DATA_DIR, `${id}.json`);
    if (!fs.existsSync(sharePath)) {
        return res.status(404).json({ error: '分享不存在' });
    }
    
    try {
        const imagePath = await generateShareImage(id);
        
        // 确保文件存在
        if (!fs.existsSync(imagePath)) {
            throw new Error('图片文件未生成');
        }
        
        console.log(`[分享图] 发送文件: ${imagePath}`);
        
        // 直接读取并发送文件
        const imageBuffer = fs.readFileSync(imagePath);
        res.set('Content-Type', 'image/png');
        res.set('Content-Length', imageBuffer.length);
        res.send(imageBuffer);
    } catch (error) {
        console.error('[分享图] 生成失败:', error);
        res.status(500).json({ error: '生成图片失败' });
    }
});

// 创建分享
app.post('/api/share/create', (req, res) => {
    try {
        const { playlist, results, aiComment, coveragePercent, aiTitle, aiSongs, shareUrlBase } = req.body;
        
        if (!playlist || !results) {
            return res.status(400).json({ success: false, error: '缺少必要数据' });
        }
        
        const shareId = generateShareId();
        const shareData = {
            id: shareId,
            playlist: {
                name: playlist.name,
                trackCount: playlist.trackCount,
                coverUrl: playlist.coverUrl
            },
            results: Object.fromEntries(
                Object.entries(results).map(([gameId, data]) => [
                    gameId,
                    {
                        totalMatches: (data.matches || []).length,  // 保存总匹配数
                        matches: (data.matches || []).slice(0, 100).map(m => ({  // 增加到100首
                            arcadeSong: {
                                title: m.arcadeSong?.title,
                                artist: m.arcadeSong?.artist,
                                coverUrl: m.arcadeSong?.coverUrl
                            },
                            score: m.score,
                            matchType: m.matchType
                        }))
                    }
                ])
            ),
            aiComment,
            aiTitle,
            aiSongs,
            shareUrl: shareUrlBase ? `${shareUrlBase}${shareId}` : null,  // 存储完整分享 URL
            coveragePercent,
            createdAt: Date.now(),
            expiresAt: Date.now() + SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        };
        
        const filePath = path.join(SHARE_DATA_DIR, `${shareId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(shareData, null, 2));
        
        console.log(`[分享] 创建成功: ${shareId}`);
        
        res.json({
            success: true,
            shareId,
            expiresAt: shareData.expiresAt
        });
    } catch (error) {
        console.error('[分享] 创建失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取分享数据
app.get('/api/share/:shareId', (req, res) => {
    try {
        const { shareId } = req.params;
        const filePath = path.join(SHARE_DATA_DIR, `${shareId}.json`);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'expired', message: '分享已过期或不存在' });
        }
        
        const shareData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // 检查是否过期
        if (Date.now() > shareData.expiresAt) {
            fs.unlinkSync(filePath);
            return res.status(404).json({ success: false, error: 'expired', message: '分享已过期' });
        }
        
        res.json({
            success: true,
            data: shareData
        });
    } catch (error) {
        console.error('[分享] 获取失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🎮 音游歌单匹配服务运行在 http://localhost:${PORT}`);
    console.log(`📁 缓存目录: ${CACHE_DIR}`);
    console.log(`⏱️  缓存有效期: 24小时`);
    console.log(`📊 游戏数量: ${Object.keys(GAMES).length}`);
    console.log(`🔧 管理后台: http://localhost:${PORT}/admin/admin.html (仅限本地访问)`);
});
