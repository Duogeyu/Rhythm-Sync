const http = require('http');

const data = JSON.stringify({
    userSongs: [
        { id: '1', name: 'FREEDOM DiVE', artists: 'xi' },
        { id: '2', name: 'Unknown', artists: 'Nobody' }
    ]
});

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/match-all',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    res.on('end', () => {
        console.log(responseData.substring(0, 500) + '...');
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    process.exit(1);
});

req.write(data);
req.end();
