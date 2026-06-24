const { parentPort, workerData } = require('worker_threads');
const Fuse = require('fuse.js');
const { normalizeTitle, normalizeArtist, artistMatch, lengthSimilarity } = require('./utils');

const { songs, userSongs, gameId, config } = workerData;

try {
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
