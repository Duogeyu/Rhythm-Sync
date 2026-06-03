const fs = require('fs');
const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

const requires = `const http = require('http');
const https = require('https');
const dns = require('dns');`;

content = content.replace(`const axios = require('axios');`, `const axios = require('axios');\n${requires}`);

const ssrfUtils = `
// ================== SSRF 防护 ==================
function isInternalIp(ip) {
    if (!ip) return true;
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

    // IPv6
    if (ip === '::' || ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true;

    // IPv4
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return false;

    if (parts[0] === 0) return true; // 0.0.0.0
    if (parts[0] === 127) return true; // loopback
    if (parts[0] === 10) return true; // private
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // private
    if (parts[0] === 192 && parts[1] === 168) return true; // private
    if (parts[0] === 169 && parts[1] === 254) return true; // metadata

    return false;
}

function safeLookup(hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    dns.lookup(hostname, options, (err, address, family) => {
        if (err) return callback(err);

        const isInternal = Array.isArray(address)
            ? address.some(a => isInternalIp(a.address || a))
            : isInternalIp(address);

        if (isInternal) {
            return callback(new Error('SSRF attempt blocked: Resolved to internal IP'));
        }
        callback(null, address, family);
    });
}

function isSafeUrl(urlStr) {
    if (!urlStr) return false;
    try {
        const url = new URL(urlStr);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

        // 简单的主机名检查（主要是为了防止直接输入IP，更深层的防御在 safeLookup）
        if (isInternalIp(url.hostname)) return false;

        return true;
    } catch {
        return false;
    }
}

const safeHttpAgent = new http.Agent({ lookup: safeLookup, keepAlive: true });
const safeHttpsAgent = new https.Agent({ lookup: safeLookup, keepAlive: true });
`;

content = content.replace(`// ============== 安全过滤函数 ==============`, `${ssrfUtils}\n// ============== 安全过滤函数 ==============`);

fs.writeFileSync(file, content);
