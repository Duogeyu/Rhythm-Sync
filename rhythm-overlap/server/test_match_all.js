const axios = require('axios');

async function testMatchAll() {
    console.log('测试多游戏并行匹配（含国服）...\n');

    const testSongs = [
        { id: 1, name: 'ナイト・オブ・ナイツ', artists: 'ビートまりお', album: '', coverUrl: '' },
        { id: 2, name: 'Bad Apple!!', artists: 'nomico', album: '', coverUrl: '' },
        { id: 3, name: 'Freedom DiVE', artists: 'xi', album: '', coverUrl: '' },
        { id: 4, name: '千本桜', artists: '黒うさP', album: '', coverUrl: '' },
        { id: 5, name: 'ロストワンの号哭', artists: 'Neru', album: '', coverUrl: '' }
    ];

    try {
        const res = await axios.post('http://localhost:3002/api/match-all', {
            userSongs: testSongs
        }, { timeout: 120000 });

        console.log(`✅ 匹配完成! (耗时 ${res.data.elapsed}ms)\n`);

        for (const [gameId, result] of Object.entries(res.data.results)) {
            console.log(`📦 ${result.config.name}`);
            if (result.stats) {
                console.log(`   曲库: ${result.stats.totalArcadeSongs} 首`);
                console.log(`   匹配: ${result.stats.matchedCount} 首 (${result.stats.overlapPercentage}%)`);
                if (result.matches.length > 0) {
                    console.log(`   示例: ${result.matches[0].userSong.name} -> ${result.matches[0].arcadeSong.title}`);
                }
            } else {
                console.log(`   ❌ 错误: ${result.error}`);
            }
            console.log();
        }

    } catch (error) {
        console.error('❌ 失败:', error.response?.data || error.message);
    }
}

testMatchAll();
