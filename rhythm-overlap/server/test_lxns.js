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
    const songIds = [3, 7, 100, 500];
    
    console.log('Testing Lxns CHUNITHM covers...\n');
    
    for (const id of songIds) {
        console.log(`\n--- ID: ${id} ---`);
        // Lxns 格式尝试
        const urls = [
            `https://lxns.net/chunithm/jacket/${id}.png`,
            `https://assets.lxns.net/chunithm/jacket/${id}.png`,
            `https://lxns.org/chunithm/jacket/${id}.png`,
            `https://api.lxns.net/v3/chunithm/song/${id}/jacket`,
            `https://assets2.lxns.net/chunithm/jacket/UI_Jacket_${String(id).padStart(4, '0')}.png`,
        ];
        
        for (const url of urls) {
            const r = await test(url);
            console.log(`${r.ok ? '✓' : '✗'} ${r.status}: ${url}`);
            if (r.ok) break;
        }
    }
    
    // 测试 Lxns API
    console.log('\n--- Testing Lxns API ---');
    try {
        const { data } = await axios.get('https://api.lxns.net/v3/chunithm/song/list', { timeout: 10000 });
        console.log('API Response type:', typeof data);
        if (data.songs && data.songs.length > 0) {
            console.log('First song:', JSON.stringify(data.songs[0], null, 2).slice(0, 500));
        }
    } catch (err) {
        console.log('API Error:', err.message);
    }
}

main();


