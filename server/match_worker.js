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

    // 2. 建立 Fuzzysort 模糊匹配索引
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
            continue; // 命中精确匹配，跳过模糊匹配
        }

        // 未命中，使用 Fuzzysort 模糊匹配
        const fuzzyResults = fuzzysort.go(userSong.name, preparedSongs, {
            keys: ['preparedTitle', 'preparedArtist'],
            threshold: -300 // 相当于 fuse.js threshold 0.3
        });

        if (fuzzyResults.length > 0) {
            // Fuzzysort 的 score 是负数，0 是完美匹配
            // 将分数映射到 0-1 范围，匹配之前的 logic
            const normalizedScore = Math.max(0, (fuzzyResults[0].score + 1000) / 1000);
            const scoreToCompare = 1 - normalizedScore;

            if (scoreToCompare < 0.3) {
                matches.push({
                    userSong,
                    arcadeSong: fuzzyResults[0].obj.original,
                    score: normalizedScore,
                    matchType: scoreToCompare < 0.1 ? 'exact' : 'fuzzy'
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
