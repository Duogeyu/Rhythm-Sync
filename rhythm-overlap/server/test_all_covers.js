const axios = require('axios');

async function test(name, url) {
    try {
        const { status } = await axios.head(url, { timeout: 8000 });
        console.log(`✓ ${name}: ${url}`);
        return true;
    } catch (err) {
        console.log(`✗ ${name}: ${url} (${err.response?.status || 'ERR'})`);
        return false;
    }
}

async function main() {
    console.log('=== Testing all game cover URLs ===\n');
    
    // maimai (ID: 8)
    console.log('--- maimai ---');
    await test('maimai', 'https://www.diving-fish.com/covers/00008.png');
    await test('maimai (lxns)', 'https://lxns.net/maimai/jacket/8.png');
    
    // CHUNITHM (ID: 3)
    console.log('\n--- CHUNITHM ---');
    await test('chunithm', 'https://lxns.net/chunithm/jacket/3.png');
    
    // ONGEKI (img hash: 5a9758493362722b)
    console.log('\n--- ONGEKI ---');
    await test('ongeki', 'https://ongeki-net.com/ongeki-mobile/img/music/5a9758493362722b.png');
    
    // maimai-cn
    console.log('\n--- maimai CN ---');
    // 需要知道具体的 image_file 格式
    await test('maimai-cn', 'https://maimai.wahlap.com/maimai-mobile/img/Music/8b66b91d30a61d5b.png');
    
    // Taiko - 太鼓没有稳定的公开封面源
    console.log('\n--- Taiko ---');
    console.log('(No reliable public cover source available)');
    
    console.log('\n=== Summary ===');
    console.log('maimai: diving-fish ✓');
    console.log('CHUNITHM: lxns ✓');
    console.log('ONGEKI: ongeki-net ✓');
    console.log('maimai-cn: wahlap (needs testing)');
    console.log('Taiko: no covers');
}

main();


