const axios = require('axios');

async function main() {
    console.log('Testing taiko database...');
    const { data } = await axios.get('https://raw.githubusercontent.com/taikowiki/taiko-song-database/main/database.json', { timeout: 60000 });
    
    console.log('Data type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    
    if (Array.isArray(data)) {
        console.log('Length:', data.length);
        console.log('\nFirst 3 items:');
        data.slice(0, 3).forEach((item, i) => {
            console.log(`\n--- Item ${i+1} ---`);
            console.log(JSON.stringify(item, null, 2));
        });
    } else if (typeof data === 'object') {
        console.log('Keys:', Object.keys(data));
        // 可能是对象格式
        const firstKey = Object.keys(data)[0];
        console.log(`\nFirst key: ${firstKey}`);
        console.log('First value:', JSON.stringify(data[firstKey], null, 2).slice(0, 1000));
    }
}

main().catch(console.error);

