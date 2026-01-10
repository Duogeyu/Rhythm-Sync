const axios = require('axios');

async function fullTest() {
    console.log('完整匹配测试...\n');

    try {
        // 获取歌单
        console.log('1. 获取用户歌单...');
        const playlistsRes = await axios.get('http://localhost:3002/api/netease/user/411352857/playlists', { timeout: 30000 });
        const playlist = playlistsRes.data.playlists[0];
        console.log(`   歌单: ${playlist.name} (${playlist.trackCount}首)`);

        // 获取歌曲
        console.log('2. 获取歌曲详情...');
        const songsRes = await axios.get(`http://localhost:3002/api/netease/playlist/${playlist.id}`, { timeout: 60000 });
        console.log(`   获取到 ${songsRes.data.songs.length} 首歌曲`);

        // 匹配 - 用前200首测试
        const testSongs = songsRes.data.songs.slice(0, 200);
        console.log(`3. 开始匹配 ${testSongs.length} 首歌曲...`);

        const startTime = Date.now();
        const matchRes = await axios.post('http://localhost:3002/api/match', {
            userSongs: testSongs,
            game: 'maimai'
        }, { timeout: 120000 });
        const elapsed = Date.now() - startTime;

        console.log(`\n✅ 匹配完成! (耗时 ${elapsed}ms)`);
        console.log('统计:', JSON.stringify(matchRes.data.stats, null, 2));

        console.log('\n前10个匹配:');
        matchRes.data.matches.slice(0, 10).forEach((m, i) => {
            console.log(`  ${i + 1}. "${m.userSong.name}" -> "${m.arcadeSong.title}"`);
        });

    } catch (error) {
        console.error('\n❌ 失败!');
        console.error('错误:', error.message);
        if (error.response) {
            console.error('状态码:', error.response.status);
            console.error('响应:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

fullTest();
