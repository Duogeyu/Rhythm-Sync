const axios = require('axios');

async function simpleTest() {
    console.log('简单匹配测试...\n');

    // 只用3首测试歌曲
    const testSongs = [
        { id: 1, name: 'ナイト・オブ・ナイツ', artists: 'ビートまりお', album: '', coverUrl: '' },
        { id: 2, name: 'Bad Apple!!', artists: 'nomico', album: '', coverUrl: '' },
        { id: 3, name: 'Freedom DiVE', artists: 'xi', album: '', coverUrl: '' }
    ];

    try {
        console.log('发送匹配请求...');
        const matchRes = await axios.post('http://localhost:3002/api/match', {
            userSongs: testSongs,
            game: 'maimai'
        }, { timeout: 30000 });

        console.log('\n✅ 匹配成功!');
        console.log('统计:', JSON.stringify(matchRes.data.stats, null, 2));
        console.log('\n匹配结果:');
        matchRes.data.matches.forEach((m, i) => {
            console.log(`  ${i + 1}. "${m.userSong.name}" -> "${m.arcadeSong.title}" (${m.matchType})`);
        });
    } catch (error) {
        console.error('\n❌ 匹配失败!');
        console.error('状态码:', error.response?.status);
        console.error('错误数据:', JSON.stringify(error.response?.data, null, 2));
    }
}

simpleTest();
