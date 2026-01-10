const https = require('https');

const options = {
    hostname: 'music.163.com',
    port: 443,
    path: '/',
    method: 'GET',
    timeout: 5000
};

console.log('开始连接 music.163.com:443...');

const req = https.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    res.on('data', d => {
        // consume data
    });
});

req.on('error', (e) => {
    console.error(`请求错误: ${e.message}`);
});

req.on('timeout', () => {
    console.error('请求超时');
    req.destroy();
});

req.end();
