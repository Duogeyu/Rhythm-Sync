const test = require('node:test');
const assert = require('node:assert');
const { normalizeTitle, normalizeArtist, levenshteinDistance } = require('./utils');

test('normalizeTitle', () => {
    assert.strictEqual(normalizeTitle(' Hello! (World)? - '), 'hello!(world)?-');
    assert.strictEqual(normalizeTitle('！？（）－'), '!?()-');
});

test('normalizeArtist', () => {
    assert.strictEqual(normalizeArtist('Artist feat. Singer'), 'artistsinger');
    assert.strictEqual(normalizeArtist('Artist CV: Singer'), 'artistsinger');
    assert.strictEqual(normalizeArtist('A,B，C、D&E＆F×G x H'), 'abcdefgh');
    assert.strictEqual(normalizeArtist('Artist (Vocal)'), 'artist');
});

test('levenshteinDistance', () => {
    assert.strictEqual(levenshteinDistance('kitten', 'sitting'), 3);
    assert.strictEqual(levenshteinDistance('flaw', 'lawn'), 2);
    assert.strictEqual(levenshteinDistance('', 'a'), 1);
    assert.strictEqual(levenshteinDistance('a', ''), 1);
});
