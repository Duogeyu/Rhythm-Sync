const axios = require('axios');

async function test(url) {
    try {
        const { status } = await axios.head(url, { timeout: 10000 });
        console.log(`✓ ${status}: ${url}`);
    } catch (err) {
        console.log(`✗ ${err.response?.status || 'ERR'}: ${url}`);
    }
}

async function main() {
    const ids = ['3', '6', '7', '100', '1000'];
    
    console.log('Testing CHUNITHM cover URL formats...\n');
    
    for (const id of ids) {
        console.log(`\n--- ID: ${id} ---`);
        
        // 各种可能的格式
        await test(`https://www.diving-fish.com/covers/chuni/${id.padStart(5, '0')}.png`);
        await test(`https://www.diving-fish.com/covers/chuni/${id}.png`);
        await test(`https://new.chunithm-net.com/chuni-mobile/html/mobile/img/${id}.png`);
        await test(`https://chunithm-net.com/mobile/img/MusicIcon/${id.padStart(4, '0')}.png`);
        await test(`https://dp4p6x0xfi5o9.cloudfront.net/chunithm/jacket/${id.padStart(4, '0')}.png`);
    }
    
    // 检查 diving-fish 的其他格式
    console.log('\n--- Checking diving-fish alternate paths ---');
    await test('https://www.diving-fish.com/covers/00008.png'); // maimai format
    await test('https://www.diving-fish.com/covers/chuni/CHU_UI_Jacket_0003.png');
}

main();

