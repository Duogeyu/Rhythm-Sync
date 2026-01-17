const axios = require('axios');

async function main() {
    console.log('Fetching CHUNITHM data from diving-fish...');
    const { data } = await axios.get('https://www.diving-fish.com/api/chunithmprober/music_data');
    
    // 查看数据结构
    const sample = data[0];
    console.log('\nSample song data:');
    console.log(JSON.stringify(sample, null, 2));
    
    // 检查是否有封面相关字段
    console.log('\nAll keys in first song:', Object.keys(sample));
    console.log('basic_info keys:', Object.keys(sample.basic_info || {}));
    
    // 测试可能的封面 URL
    const id = sample.id;
    console.log(`\nSong ID: ${id}`);
    
    // 尝试不同的 URL 格式
    const urls = [
        `https://new.chunithm-net.com/chuni-mobile/html/mobile/img/Music/${String(id).padStart(8, '0')}.png`,
        `https://chunithm.sega.jp/storage/chuni/music/jacket/${String(id).padStart(6, '0')}.png`,
        `https://sdvx.in/chunithm/jacket/${String(id).padStart(4, '0')}.png`,
    ];
    
    for (const url of urls) {
        try {
            const { status } = await axios.head(url, { timeout: 5000 });
            console.log(`✓ ${status}: ${url}`);
        } catch (err) {
            console.log(`✗ ${err.response?.status || 'ERR'}: ${url}`);
        }
    }
}

main().catch(console.error);

