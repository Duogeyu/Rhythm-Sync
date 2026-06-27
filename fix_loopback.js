const fs = require('fs');
let content = fs.readFileSync('server/index.js', 'utf8');

content = content.replace(
    "if (cleanIp === '0.0.0.0' || cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === '::') return true;",
    "if (cleanIp === '0.0.0.0' || cleanIp.startsWith('127.') || cleanIp === '::1' || cleanIp === '::') return true;"
);

fs.writeFileSync('server/index.js', content);
console.log('Fixed loopback check');
