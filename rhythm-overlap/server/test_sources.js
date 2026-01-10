const axios = require('axios');

async function testSources() {
    console.log('测试各数据源...\n');

    // 测试 1: reiwa.f5.si
    try {
        const res1 = await axios.get('https://reiwa.f5.si/maimai_all.json', { timeout: 10000 });
        console.log('✅ reiwa.f5.si/maimai_all.json');
        console.log('   歌曲数量:', res1.data.length);
        if (res1.data[0]) {
            console.log('   示例:', JSON.stringify(res1.data[0], null, 2).slice(0, 200));
        }
    } catch (e) {
        console.log('❌ reiwa.f5.si:', e.message);
    }

    // 测试 2: lxns.net (diving-fish)
    try {
        const res2 = await axios.get('https://www.diving-fish.com/api/maimaidxprober/music_data', { timeout: 10000 });
        console.log('\n✅ diving-fish.com/api/maimaidxprober/music_data');
        console.log('   歌曲数量:', res2.data.length);
        if (res2.data[0]) {
            console.log('   示例:', JSON.stringify(res2.data[0], null, 2).slice(0, 300));
        }
    } catch (e) {
        console.log('❌ diving-fish:', e.message);
    }
}

testSources();
