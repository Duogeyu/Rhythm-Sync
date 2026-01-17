const axios = require('axios');

async function test(name, url) {
    console.log(`\nTesting ${name}...`);
    console.log(`URL: ${url}`);
    try {
        const start = Date.now();
        const { data, status } = await axios.get(url, { 
            timeout: 15000,
            validateStatus: () => true // Accept any status
        });
        const elapsed = Date.now() - start;
        console.log(`Status: ${status}, Time: ${elapsed}ms`);
        if (typeof data === 'object') {
            const len = Array.isArray(data) ? data.length : Object.keys(data).length;
            console.log(`Data: ${len} items`);
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

async function main() {
    // Test jsDelivr CDN
    await test('maimai-cn (jsDelivr)', 'https://cdn.jsdelivr.net/gh/CrazyKidCN/maimaiDX-CN-songs-database@main/maidata.json');
    await test('taiko (jsDelivr)', 'https://cdn.jsdelivr.net/gh/taikowiki/taiko-song-database@main/database.json');
    
    // Test ONGEKI cover URL formats
    console.log('\n--- Testing ONGEKI cover URLs ---');
    const imgHash = '5a9758493362722b';
    const testUrls = [
        `https://ongeki-net.com/ongeki-mobile/img/music/${imgHash}.png`,
        `https://reiwa.f5.si/ongeki/jacket/${imgHash}.png`,
        `https://dp4p6x0xfi5o9.cloudfront.net/ongeki/img/cover/${imgHash}.png`,
    ];
    
    for (const url of testUrls) {
        await test('ONGEKI cover', url);
    }
    
    // Test CHUNITHM cover
    console.log('\n--- Testing CHUNITHM cover URLs ---');
    const chuniId = '3';
    const chuniUrls = [
        `https://www.diving-fish.com/covers/chuni/${chuniId.padStart(5, '0')}.png`,
        `https://new.chunithm-net.com/chuni-mobile/html/mobile/img/${chuniId}.png`,
    ];
    
    for (const url of chuniUrls) {
        await test('CHUNITHM cover', url);
    }
}

main();


