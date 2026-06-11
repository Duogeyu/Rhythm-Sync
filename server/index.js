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
    
    // 移除危险字符 and 潜在的脚本注入
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

// ================== 安全配置 ==================
// 安全：校验文件名和ID，防止路径穿越攻击
function isSafeFilename(filename) {
    if (typeof filename !== 'string') return false;
    // 允许冒号、管道符等用于特殊ID，但拦截核心路径穿越字符
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
        return false;
    }
    return true;
}

// 提取经常在路径中使用的参数名，并应用安全校验
const pathParams = ['id', 'fileName', 'gameId', 'shareId', 'sessionId', 'shortId', 'uid', 'songId'];
app.param(pathParams, (req, res, next, val, name) => {
    // 校验预期的标识符参数
    if (!isSafeFilename(val)) {
        console.warn(`[安全] 拦截到非法的路径参数 ${name} = ${val}`);
        return res.status(400).json({ error: '无效的请求参数' });
    }
    next();
});

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

// Helper to normalize individual games
function normalizeOtogeMaimai(s, gameId) {
    const hasDxChart = s.dx_lev_bas || s.dx_lev_adv || s.dx_lev_exp || s.dx_lev_mas || s.dx_lev_remas;
    const hasStdChart = s.lev_bas || s.lev_adv || s.lev_exp || s.lev_mas || s.lev_remas;
    const chartType = hasDxChart ? 'DX' : 'SD';
    
    const charts = [];
    const levels = [];
    const ds = [];
    
    if (hasDxChart) {
        if (s.dx_lev_bas) { charts.push({ difficulty: 'Basic', level: s.dx_lev_bas, ds: parseFloat(s.dx_lev_bas_i) || 0, notes: parseInt(s.dx_lev_bas_notes) || 0 }); levels.push(s.dx_lev_bas); ds.push(parseFloat(s.dx_lev_bas_i) || 0); }
        if (s.dx_lev_adv) { charts.push({ difficulty: 'Advanced', level: s.dx_lev_adv, ds: parseFloat(s.dx_lev_adv_i) || 0, notes: parseInt(s.dx_lev_adv_notes) || 0 }); levels.push(s.dx_lev_adv); ds.push(parseFloat(s.dx_lev_adv_i) || 0); }
        if (s.dx_lev_exp) { charts.push({ difficulty: 'Expert', level: s.dx_lev_exp, ds: parseFloat(s.dx_lev_exp_i) || 0, notes: parseInt(s.dx_lev_exp_notes) || 0, designer: s.dx_lev_exp_designer }); levels.push(s.dx_lev_exp); ds.push(parseFloat(s.dx_lev_exp_i) || 0); }
        if (s.dx_lev_mas) { charts.push({ difficulty: 'Master', level: s.dx_lev_mas, ds: parseFloat(s.dx_lev_mas_i) || 0, notes: parseInt(s.dx_lev_mas_notes) || 0, designer: s.dx_lev_mas_designer }); levels.push(s.dx_lev_mas); ds.push(parseFloat(s.dx_lev_mas_i) || 0); }
        if (s.dx_lev_remas) { charts.push({ difficulty: 'Re:Master', level: s.dx_lev_remas, ds: parseFloat(s.dx_lev_remas_i) || 0, notes: parseInt(s.dx_lev_remas_notes) || 0, designer: s.dx_lev_remas_designer }); levels.push(s.dx_lev_remas); ds.push(parseFloat(s.dx_lev_remas_i) || 0); }
    } else if (hasStdChart) {
        if (s.lev_bas) { charts.push({ difficulty: 'Basic', level: s.lev_bas, ds: parseFloat(s.lev_bas_i) || 0, notes: parseInt(s.lev_bas_notes) || 0 }); levels.push(s.lev_bas); ds.push(parseFloat(s.lev_bas_i) || 0); }
        if (s.lev_adv) { charts.push({ difficulty: 'Advanced', level: s.lev_adv, ds: parseFloat(s.lev_adv_i) || 0, notes: parseInt(s.lev_adv_notes) || 0 }); levels.push(s.lev_adv); ds.push(parseFloat(s.lev_adv_i) || 0); }
        if (s.lev_exp) { charts.push({ difficulty: 'Expert', level: s.lev_exp, ds: parseFloat(s.lev_exp_i) || 0, notes: parseInt(s.lev_exp_notes) || 0, designer: s.lev_exp_designer }); levels.push(s.lev_exp); ds.push(parseFloat(s.lev_exp_i) || 0); }
        if (s.lev_mas) { charts.push({ difficulty: 'Master', level: s.lev_mas, ds: parseFloat(s.lev_mas_i) || 0, notes: parseInt(s.lev_mas_notes) || 0, designer: s.lev_mas_designer }); levels.push(s.lev_mas); ds.push(parseFloat(s.lev_mas_i) || 0); }
        if (s.lev_remas) { charts.push({ difficulty: 'Re:Master', level: s.lev_remas, ds: parseFloat(s.lev_remas_i) || 0, notes: parseInt(s.lev_remas_notes) || 0, designer: s.lev_remas_designer }); levels.push(s.lev_remas); ds.push(parseFloat(s.lev_remas_i) || 0); }
    }

    let coverUrl = s.image_url ? `https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/jacket/${s.image_url}` : (s.id ? `https://maimaidx.jp/maimai-mobile/img/Music/${s.id}.png` : null);

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
        wikiUrl: s.wiki_url || null,
        dateAdded: s.date_added || null,
        dateIntlAdded: s.date_intl_added || null
    };
}

function normalizeSongs(data, type, gameId) {
    if (type === 'otoge-maimai') {
        return data.map(s => normalizeOtogeMaimai(s, gameId));
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
            gameId,
            id: String(s.id),
            title: s.title,
            artist: s.basic_info?.artist || '',
            category: s.basic_info?.genre || '',
            version: s.basic_info?.from || '',
            bpm: s.basic_info?.bpm || 0,
            coverUrl: `https://www.diving-fish.com/covers/${String(s.id).padStart(5, '0')}.png`,
            type: s.type || 'SD',
            isNew: s.basic_info?.is_new || false,
            levels: s.level || [],
            ds: s.ds || [],
            charts: s.charts?.map((c, i) => ({
                difficulty: ['Basic', 'Advanced', 'Expert', 'Master', 'Re:Master'][i] || `Lv${i}`,
                level: s.level?.[i] || '?',
                ds: s.ds?.[i] || 0,
                charter: c.charter || '-',
                notes: c.notes || []
            })) || []
        }));
    } else if (type === 'diving-fish-chunithm') {
        return data.map(s => ({
            gameId,
            id: String(s.id),
            title: s.title,
            artist: s.basic_info?.artist || '',
            category: s.basic_info?.genre || '',
            version: s.basic_info?.from || '',
            bpm: s.basic_info?.bpm || 0,
            coverUrl: `https://lxns.net/chunithm/jacket/${s.id}.png`,
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
        return data.map(s => {
            const id = s.meta?.id || String(Math.random());
            const imgHash = s.meta?.img;
            const coverUrl = imgHash 
                ? `https://ongeki-net.com/ongeki-mobile/img/music/${imgHash}.png`
                : null;
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
                gameId,
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
        return data.map(s => ({
            gameId,
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
        const genreMap = {
            'pops': 'J-POP', 'anime': 'アニメ', 'vocaloid': 'ボーカロイド',
            'variety': 'バラエティ', 'classical': 'クラシック', 'game': 'ゲームミュージック',
            'namco': 'ナムコオリジナル', 'kids': 'キッズ'
        };
        
        return data.map(s => {
            const coverUrl = s.image?.url || s.jacket || s.coverUrl || (s.songNo ? `https://taiko.namco-ch.net/taiko/images/songimage/${s.songNo}.png` : null);
            const diffMap = { 'easy': 'かんたん', 'normal': 'ふつう', 'hard': 'むずかしい', 'oni': 'おに', 'ura': '裏おに' };
            const charts = [];
            if (s.courses) {
                Object.entries(s.courses).forEach(([key, val]) => {
                    if (val && typeof val === 'object') {
                        charts.push({ difficulty: diffMap[key] || key, level: val.level?.toString() || '?', ds: val.level || 0 });
                    }
                });
            }
            let category = Array.isArray(s.genre) ? s.genre.map(g => genreMap[g] || g).join(' & ') : (genreMap[s.genre] || s.genre || '');
            let artist = Array.isArray(s.artists) ? s.artists.join(', ') : (s.artist || '');
            let version = Array.isArray(s.version) ? (s.version.length > 3 ? `${s.version.length}平台` : s.version[0]) : (s.version || '');
            
            return {
                gameId,
                id: s.songNo || String(Math.random()),
                title: s.title || '',
                artist, category, version,
                bpm: s.bpm || 0,
                coverUrl,
                levels: charts.map(c => c.level),
                ds: charts.map(c => c.ds),
                charts
            };
        });
    }
    return data.map(s => ({ ...s, gameId }));
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

// Levenshtein 距离优化，共享缓冲区避免重复分配
const LEVENSHTEIN_BUFFER_SIZE = 1024;
const sharedLevenshteinBuffer = new Uint16Array(LEVENSHTEIN_BUFFER_SIZE);

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

        // Levenshtein 编辑距离 (优化版：O(n) 空间，减少 GC)
        const levenshteinDistance = (s1, s2) => {
            const len1 = s1.length;
            const len2 = s2.length;
            if (len1 === 0) return len2;
            if (len2 === 0) return len1;
            
            // 如果字符串过长，回退到动态分配数组，避免越界
            if (len1 >= LEVENSHTEIN_BUFFER_SIZE) {
                const row = new Uint16Array(len1 + 1);
                for (let j = 0; j <= len1; j++) {
                    row[j] = j;
                }
                for (let i = 1; i <= len2; i++) {
                    let prev = i;
                    let prevDiagonal = i - 1;
                    const c2 = s2.charCodeAt(i - 1);
                    for (let j = 1; j <= len1; j++) {
                        let current;
                        if (c2 === s1.charCodeAt(j - 1)) {
                            current = prevDiagonal;
                        } else {
                            current = Math.min(
                                prevDiagonal, // 替换
                                prev,         // 插入
                                row[j]        // 删除
                            ) + 1;
                        }
                        prevDiagonal = row[j];
                        row[j] = current;
                        prev = current;
                    }
                }
                return row[len1];
            }
            
            // 使用共享 buffer 以减少 GC 压力
            for (let j = 0; j <= len1; j++) {
                sharedLevenshteinBuffer[j] = j;
            }
            for (let i = 1; i <= len2; i++) {
                let prev = i;
                let prevDiagonal = i - 1;
                const c2 = s2.charCodeAt(i - 1);
                for (let j = 1; j <= len1; j++) {
                    let current;
                    if (c2 === s1.charCodeAt(j - 1)) {
                        current = prevDiagonal;
                    } else {
                        current = Math.min(
                            prevDiagonal,
                            prev,
                            sharedLevenshteinBuffer[j]
                        ) + 1;
                    }
                    prevDiagonal = sharedLevenshteinBuffer[j];
                    sharedLevenshteinBuffer[j] = current;
                    prev = current;
                }
            }
            return sharedLevenshteinBuffer[len1];
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
                        key: 'title',
                        limit: 3,
                        threshold: threshold
                    });

                    if (results.length > 0) {
                        // 在前三个模糊匹配中，寻找艺术家最匹配的
                        let bestMatch = null;
                        let bestScore = -1;

                        for (const result of results) {
                            const arcadeSong = result.obj;
                            const titleSim = 1 - (levenshteinDistance(normalizedName, normalizeTitle(arcadeSong.title)) / Math.max(normalizedName.length, arcadeSong.title.length));
                            const artistScore = artistMatch(userSong.artists, arcadeSong.artist);
                            const lenSim = lengthSimilarity(userSong.name, arcadeSong.title);
                            
                            // 综合评分：标题相似度占 50%，艺术家相似度占 30%，长度相似度占 20%
                            const totalScore = (titleSim * 0.5) + (artistScore * 0.3) + (lenSim * 0.2);
                            
                            if (totalScore > bestScore) {
                                bestScore = totalScore;
                                bestMatch = { arcadeSong, titleSim, artistScore, lenSim, score: totalScore };
                            }
                        }

                        // 最终阈值检查：艺术家必须有一定相似度，或者标题非常像
                        if (bestMatch && (bestMatch.score > 0.6 || (bestMatch.titleSim > 0.85 && bestMatch.lenSim > 0.8))) {
                            const tags = [];
                            if (bestMatch.artistScore >= 0.7) tags.push('same_artist');
                            else if (bestMatch.artistScore >= 0.3) tags.push('similar_artist');
                            
                            if (bestMatch.titleSim > 0.9) tags.push('exact_title');
                            else tags.push('similar_title');
                            
                            match = {
                                userSong,
                                arcadeSong: bestMatch.arcadeSong,
                                score: bestMatch.score,
                                matchType: 'fuzzy',
                                tags,
                                artistScore: bestMatch.artistScore,
                                titleScore: bestMatch.titleSim
                            };
                        }
                    }
                }

                if (match) {
                    songMatches[gameId] = match;
                    // 记录到日志数据中
                    if (!matchResultsForLog[gameId]) matchResultsForLog[gameId] = { matches: [] };
                    matchResultsForLog[gameId].matches.push(match);
                }
            });

            batchResults.push({ userSong, matches: songMatches });
            processedCount++;

            if (batchResults.length >= BATCH_SIZE || processedCount === userSongs.length) {
                sendEvent('progress', {
                    processed: processedCount,
                    total: userSongs.length,
                    results: batchResults
                });
                batchResults = [];
            }
        }

        // 4. 完成
        const duration = Date.now() - startTime;
        sendEvent('complete', { duration });
        console.log(`[MATCH] 任务完成 - Session: ${sessionId} | 耗时: ${duration}ms`);

        // 5. 保存查询日志
        saveQueryLog({
            sessionId,
            clientIp,
            neteaseUid,
            playlistId,
            playlistName,
            songCount: userSongs.length,
            matchResults: matchResultsForLog,
            startTime,
            endTime: Date.now()
        });

    } catch (error) {
        console.error(`[MATCH] Stream error:`, error);
        sendEvent('error', { message: error.message });
    } finally {
        res.end();
    }
});

// ============== 游戏数据管理 API ==============

// 获取当前数据源配置
app.get('/api/admin/sources', (req, res) => {
    res.json({
        success: true,
        games: GAMES,
        sources: DATA_SOURCES,
        activeSelections,
        config: GAME_CONFIG
    });
});

// 切换数据源
app.post('/api/admin/sources/switch', (req, res) => {
    const { gameId, sourceId } = req.body;
    const result = switchGameSource(gameId, sourceId);
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// 批量更新数据源
app.post('/api/admin/sources/batch-switch', (req, res) => {
    const { selections } = req.body; // { gameId: sourceId, ... }
    if (!selections || typeof selections !== 'object') {
        return res.status(400).json({ success: false, error: '无效的选择数据' });
    }

    const results = [];
    for (const [gameId, sourceId] of Object.entries(selections)) {
        results.push(switchGameSource(gameId, sourceId));
    }

    res.json({ success: true, results });
});

// 清除游戏缓存（强制重新抓取）
app.post('/api/admin/cache/clear/:gameId', (req, res) => {
    const { gameId } = req.params;
    const filePath = getCacheFilePath(gameId);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[缓存] 已清除 ${gameId} 缓存`);
        res.json({ success: true, message: `已清除 ${gameId} 缓存` });
    } else {
        res.json({ success: true, message: '缓存不存在' });
    }
});

// ============== AI 锐评系统 (DeepSeek-V3) ==============

const commentCacheFile = path.join(__dirname, '.cache', 'ai-comments.json');
const commentCache = new Map(); // key: "neteaseUid_playlistId" -> { comment, timestamp }

// 启动时加载 AI 评论缓存
try {
    if (fs.existsSync(commentCacheFile)) {
        const data = JSON.parse(fs.readFileSync(commentCacheFile, 'utf-8'));
        for (const [k, v] of Object.entries(data)) commentCache.set(k, v);
        console.log(`[AI] 已加载 ${commentCache.size} 条评论缓存`);
    }
} catch (e) { console.warn('[AI] 缓存加载失败:', e.message); }

function saveCommentCache() {
    try {
        fs.writeFileSync(commentCacheFile, JSON.stringify(Object.fromEntries(commentCache)), 'utf-8');
    } catch (e) { console.warn('[AI] 缓存保存失败:', e.message); }
}

app.post('/api/ai/comment', async (req, res) => {
    const { neteaseUid, playlistId, playlistName, matchStats } = req.body;
    const cacheKey = `${neteaseUid || 'guest'}_${playlistId || 'custom'}`;

    // 1. 检查缓存 (1小时内有效)
    if (commentCache.has(cacheKey)) {
        const cached = commentCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 3600000) {
            return res.json({ success: true, comment: cached.comment, cached: true });
        }
    }

    // 2. 如果没有配置 API Key，使用本地随机降级文案
    if (!SILICONFLOW_API_KEY) {
        const fallbackComments = [
            `你的歌单《${playlistName}》真是深不可测。我看了一下，你在街机音游里简直就是个隐藏的大神，匹配度相当惊人！`,
            `《${playlistName}》里居然有这么多样化的曲风，虽然音游里只出现了一部分，但这品味确实独特。`,
            `看来你真的很喜欢这些旋律，歌单里的不少歌都是音游里的魔王曲。去机厅露一手吧！`
        ];
        const comment = fallbackComments[Math.floor(Math.random() * fallbackComments.length)];
        return res.json({ success: true, comment, fallback: true });
    }

    // 3. 构建 Prompt 调用 AI
    try {
        const systemPrompt = `你是一个毒舌但又极其懂行、沉迷各种街机音游（maimai, CHUNITHM, Ongeki, 太鼓达人等）的资深音游老哥。
你的任务是根据用户提供的网易云歌单匹配结果，写一段 100 字左右的"锐评"。
要求：
1. 语气要像机厅老哥，多用圈内黑话（如：推分、魔王、出勤、紫谱、FC、AP等）。
2. 根据匹配到的歌曲数量和比例来调整语气：如果匹配比例很高，就夸他是顶级出勤选手；如果很低，就吐槽他是“纯粹的现充”或者“听歌品味太小众”。
3. 提到歌单名字 "${playlistName}"。
4. 语言风格要幽默、略带调侃，不要太死板。`;

        const userPrompt = `歌单名：${playlistName}
歌曲总数：${matchStats.totalUserSongs}
maimai 匹配数：${matchStats.maimai || 0}
CHUNITHM 匹配数：${matchStats.chunithm || 0}
太鼓达人匹配数：${matchStats.taiko || 0}
整体街机重合度：${matchStats.overlapPercentage}%`;

        const response = await axios.post(SILICONFLOW_API_URL, {
            model: SILICONFLOW_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 300
        }, {
            headers: { 'Authorization': `Bearer ${SILICONFLOW_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 15000
        });

        const comment = response.data.choices[0].message.content.trim();

        // 存入缓存
        commentCache.set(cacheKey, { comment, timestamp: Date.now() });
        saveCommentCache();

        res.json({ success: true, comment, cached: false });
    } catch (error) {
        console.error('[AI] 调用失败:', error.message);
        res.status(500).json({ success: false, error: 'AI 暂时掉线了，请稍后再试' });
    }
});

// ============== 交叉检查 API ==============
app.get('/api/check', async (req, res) => {
    try {
        const { title, artist } = req.query;
        if (!title) return res.status(400).json({ success: false, error: '缺少 title 参数' });

        const results = {};
        let foundInGames = 0;
        const gameIds = Object.keys(GAME_CONFIG);

        // 并行检查所有游戏
        await Promise.all(gameIds.map(async (gameId) => {
            const songs = await fetchGameSongs(gameId);
            const normalizedTarget = title.toLowerCase().replace(/\s+/g, '');
            
            // 先尝试精确匹配
            let match = songs.find(s => s.title.toLowerCase().replace(/\s+/g, '') === normalizedTarget);
            
            // 如果提供了艺术家，辅助匹配
            if (!match && artist) {
                const normalizedArtist = artist.toLowerCase().replace(/\s+/g, '');
                // 简单的模糊查找
                match = songs.find(s => 
                    s.title.toLowerCase().includes(title.toLowerCase()) && 
                    (s.artist.toLowerCase().includes(normalizedArtist) || normalizedArtist.includes(s.artist.toLowerCase()))
                );
            }

            if (match) {
                foundInGames++;
                results[gameId] = {
                    gameName: GAME_CONFIG[gameId].shortName,
                    found: true,
                    song: {
                        id: match.id,
                        title: match.title,
                        artist: match.artist,
                        charts: match.charts,
                        levels: match.levels,
                        coverUrl: match.coverUrl
                    }
                };
            } else {
                results[gameId] = {
                    gameName: GAME_CONFIG[gameId].shortName,
                    found: false
                };
            }
        }));

        res.json({
            success: true,
            title,
            foundInGames,
            totalGames: gameIds.length,
            matches: results
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============== 启动服务器 ==============
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
  Rhythm-Sync 后端启动成功!
  -------------------------
  本地访问: http://localhost:${PORT}
  数据目录: ${CACHE_DIR}
  封面目录: ${COVERS_DIR}
  日志目录: ${LOG_DIR}
  -------------------------
  已就绪, 等待连接...
  `);
});
