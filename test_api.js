const axios = require('axios');
const appUrl = 'http://localhost:3002';

async function testApi() {
    try {
        const response = await axios.post(`${appUrl}/api/match-all`, {
            userSongs: [
                { id: '1', name: 'FREEDOM DiVE', artists: 'xi' },
                { id: '2', name: 'Unknown', artists: 'Nobody' }
            ]
        });
        console.log("Success:", response.data);
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}
testApi();
