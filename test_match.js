const { Worker } = require('worker_threads');
const path = require('path');

const gameId = 'test';
const config = {};
const songs = [
    { title: 'FREEDOM DiVE', artist: 'xi' },
    { title: 'Grievous Lady', artist: 'Team Grimoire vs Laur' },
    { title: 'Cyaegha', artist: 'USAO' }
];

const userSongs = [
    { name: 'FREEDOM DiVE', artists: 'xi' },
    { name: 'freedom', artists: '' },
    { name: 'Griovus Lady', artists: 'Laur' },
    { name: 'Unknown', artists: 'Nobody' }
];

const worker = new Worker(path.join(__dirname, 'server/match_worker.js'), {
    workerData: { songs, userSongs, gameId, config }
});

worker.on('message', (msg) => {
    console.log(JSON.stringify(msg, null, 2));
    process.exit(0);
});
worker.on('error', (err) => {
    console.error(err);
    process.exit(1);
});
