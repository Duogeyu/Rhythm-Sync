const { user_playlist } = require('NeteaseCloudMusicApi');

async function test() {
    console.log('开始测试 NeteaseCloudMusicApi user_playlist...');
    try {
        const result = await user_playlist({
            uid: '32953014',
            limit: 10,
            debug: true
        });
        console.log('成功:', result.status);
        console.log('歌单数量:', result.body.playlist?.length);
    } catch (error) {
        console.error('失败:', error);
    }
}

test();
