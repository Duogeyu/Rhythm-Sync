const axios = require('axios');

const sources = {
    'maimai': 'https://www.diving-fish.com/api/maimaidxprober/music_data',
    'maimai-cn': 'https://raw.githubusercontent.com/CrazyKidCN/maimaiDX-CN-songs-database/main/maidata.json',
    'chunithm': 'https://www.diving-fish.com/api/chunithmprober/music_data',
    'ongeki': 'https://reiwa.f5.si/ongeki_all.json',
    'taiko': 'https://raw.githubusercontent.com/taikowiki/taiko-song-database/main/database.json'
};

async function testSource(name, url) {
    console.log(`\n========== ${name} ==========`);
    console.log(`URL: ${url}`);
    
    try {
        const { data } = await axios.get(url, { timeout: 30000 });
        
        // 取前3条数据查看结构
        const sample = Array.isArray(data) ? data.slice(0, 3) : [data];
        
        console.log(`\n数据条数: ${Array.isArray(data) ? data.length : 'N/A'}`);
        console.log(`\n样本数据结构:`);
        sample.forEach((item, i) => {
            console.log(`\n--- 第 ${i+1} 条 ---`);
            console.log(JSON.stringify(item, null, 2).slice(0, 1500));
        });
        
    } catch (err) {
        console.error(`错误: ${err.message}`);
    }
}

async function main() {
    for (const [name, url] of Object.entries(sources)) {
        await testSource(name, url);
    }
}

main();

