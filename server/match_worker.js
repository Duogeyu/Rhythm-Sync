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

    // 2. 预处理 fuzzysort 标题和艺术家以加速搜索
    const preparedSongs = songs.map(s => ({
        ...s,
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
            continue; // 命中精确匹配，跳过模糊匹配
        }

        // 未命中，使用 fuzzysort 模糊匹配
        // 短标题（<6字符）需要更严格的匹配
        const isShortTitle = userSong.name.length < 6;
        const threshold = isShortTitle ? -500 : -1200;

        const results = fuzzysort.go(userSong.name, preparedSongs, {
            keys: ['preparedTitle', 'preparedArtist'],
            limit: 1,
            threshold: threshold
        });

        if (results.length > 0) {
            const result = results[0];
            // Normalize fuzzysort score to 0-1 scale
            const score = Math.max(0, (result.score + 1000) / 1000);
            if (score > 0.7) { // Equivalent to Fuse score < 0.3
                matches.push({
                    userSong,
                    arcadeSong: result.obj,
                    score: score,
                    matchType: score > 0.9 ? 'exact' : 'fuzzy' // Equivalent to Fuse score < 0.1
                });
            }
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
