const axios = require('axios');

const urls = [
    // chunithm-cn-tools 可能的数据位置
    'https://chunithm.wahlap.com/mobile/data/songs.json',
    'https://chunithm.wahlap.com/mobile/record/musicGenre/sendBasic',
    // arcade-songs 可能的数据位置
    'https://arcade-songs.zetaraku.dev/data/chunithm/songs.json',
    'https://dp4p6x0xfi5o9.cloudfront.net/chunithm/data.json',
    // 其他可能的数据源
    'https://chuniviewer.net/api/songs',
    'https://chunithmnet-eng.sega.com/mobile/record/musicGenre/sendBasic',
];

async function testUrls() {
    console.log('测试 CHUNITHM 国服可能的数据源...\n');

    for (const url of urls) {
        try {
            const res = await axios.get(url, {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            console.log(`✅ ${url}`);
            console.log(`   状态: ${res.status}`);
            console.log(`   数据类型: ${typeof res.data}`);
            if (Array.isArray(res.data)) {
                console.log(`   数组长度: ${res.data.length}`);
            }
        } catch (e) {
            console.log(`❌ ${url}`);
            console.log(`   错误: ${e.response?.status || e.message}`);
        }
        console.log();
    }
}

testUrls();
