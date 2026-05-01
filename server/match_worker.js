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

    // 2. 预处理 fuzzysort 模糊匹配索引
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
        const fuzzysortResults = fuzzysort.go(userSong.name, preparedSongs, {
            keys: ['preparedTitle', 'preparedArtist'],
            limit: 1,
            threshold: -300
        });

        if (fuzzysortResults.length > 0) {
            const bestScoreNormalized = Math.min(1, Math.max(0, (fuzzysortResults[0].score + 1000) / 1000));
            const item = { ...fuzzysortResults[0].obj };
            delete item.preparedTitle;
            delete item.preparedArtist;

            matches.push({
                userSong,
                arcadeSong: item,
                score: bestScoreNormalized,
                matchType: bestScoreNormalized > 0.9 ? 'exact' : 'fuzzy'
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
