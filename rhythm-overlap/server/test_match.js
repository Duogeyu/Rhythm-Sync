const axios = require('axios');

async function testMatch() {
    console.log('测试匹配 API...\n');

    // 先获取用户歌单
    const playlistsRes = await axios.get('http://localhost:3002/api/netease/user/411352857/playlists');
    console.log('歌单数量:', playlistsRes.data.playlists.length);

    // 获取第一个歌单的歌曲
    const firstPlaylist = playlistsRes.data.playlists[0];
    console.log('歌单名称:', firstPlaylist.name, '歌曲数:', firstPlaylist.trackCount);

    const songsRes = await axios.get(`http://localhost:3002/api/netease/playlist/${firstPlaylist.id}`);
    console.log('获取到歌曲数:', songsRes.data.songs.length);

    // 测试匹配 - 用前100首
    console.log('\n开始匹配...');
    try {
        const matchRes = await axios.post('http://localhost:3002/api/match', {
            userSongs: songsRes.data.songs.slice(0, 100),
            game: 'maimai'
        });
        console.log('\n✅ 匹配成功!');
        console.log('统计:', matchRes.data.stats);
        console.log('\n前5个匹配:');
        matchRes.data.matches.slice(0, 5).forEach((m, i) => {
            console.log(`  ${i + 1}. ${m.userSong.name} -> ${m.arcadeSong.title} (${m.matchType})`);
        });
    } catch (error) {
        console.error('匹配失败:', error.response?.data || error.message);
    }
}

testMatch();
