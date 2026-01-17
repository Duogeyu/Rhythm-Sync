const axios = require('axios');

async function test(url) {
    try {
        const { status } = await axios.head(url, { timeout: 8000 });
        return { url, status, ok: status === 200 };
    } catch (err) {
        return { url, status: err.response?.status || 'ERR', ok: false };
    }
}

async function main() {
    // 测试各种可能的 CHUNITHM 封面源
    const songIds = [3, 7, 100, 500, 1000];
    
    const sources = [
        (id) => `https://chunirec.net/api/records/jacket/${String(id).padStart(4, '0')}.png`,
        (id) => `https://sdvx.in/chunithm/01/jacket/${String(id).padStart(4, '0')}.jpg`,
        (id) => `https://reiwa.f5.si/chunithm/jacket/${String(id)}.png`,
        (id) => `https://dp4p6x0xfi5o9.cloudfront.net/chunithm/img/cover/CHUNITHM${String(id).padStart(4, '0')}.png`,
    ];
    
    for (const id of songIds) {
        console.log(`\n--- Testing ID: ${id} ---`);
        for (const getUrl of sources) {
            const result = await test(getUrl(id));
            console.log(`${result.ok ? '✓' : '✗'} ${result.status}: ${result.url}`);
        }
    }
    
    // 也测试 sdvx.in 是否有 CHUNITHM 封面目录
    console.log('\n--- Testing sdvx.in structure ---');
    await test('https://sdvx.in/chunithm/').then(r => console.log(r.ok ? '✓' : '✗', r.url));
}

main();


