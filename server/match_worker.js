const { parentPort, workerData } = require('worker_threads');
const fuzzysort = require('fuzzysort');
const { normalizeTitle } = require('./utils');

const { songs, userSongs, gameId, config } = workerData;

try {
    // 1. 建立精确匹配索引 (Map)
    const titleMap = new Map();
    songs.forEach(s => {
        titleMap.set(normalizeTitle(s.title), s);
        // 尝试保留原始标题作为 key 备用
        titleMap.set(s.title, s);
    });

    // 2. 建立 fuzzysort 模糊匹配索引
    const preparedSongs = songs.map(s => ({
        original: s,
        preparedTitle: fuzzysort.prepare(s.title || ''),
        preparedArtist: fuzzysort.prepare(s.artist || '')
    }));

    const matches = [];

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
            continue; // 命中精确匹配，跳过 fuzzysort
        }

        // 未命中，使用 fuzzysort 模糊匹配
        const results = fuzzysort.go(userSong.name, preparedSongs, {
            keys: ['preparedTitle', 'preparedArtist'],
            limit: 1,
            threshold: -300 // 对应原 fuse.js 的 0.3 阈值
        });

        if (results.length > 0) {
            // 将 fuzzysort 分数(-1000~0) 转换为 0~1 的正向分数
            const normalizedScore = Math.max(0, (results[0].score + 1000) / 1000);

            // fuse.js的逻辑: score < 0.1 为 exact, < 0.3 为 fuzzy
            // 对应的正向分数: score > 0.9 为 exact, > 0.7 为 fuzzy
            matches.push({
                userSong,
                arcadeSong: results[0].obj.original,
                score: normalizedScore,
                matchType: normalizedScore > 0.9 ? 'exact' : 'fuzzy'
            });
        }
    }

    const stats = {
        totalUserSongs: userSongs.length,
        totalArcadeSongs: songs.length,
        matchedCount: matches.length,
        overlapPercentage: Math.round((matches.length / userSongs.length) * 100)
    };

    const result = {
        [gameId]: {
            config,
            stats,
            matches: matches.sort((a, b) => b.score - a.score)
        }
    };

    parentPort.postMessage({ success: true, result });

} catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
}
