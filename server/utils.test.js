const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeTitle, normalizeArtist } = require('./utils.js');

test('normalizeTitle correctly normalizes titles', (t) => {
    assert.strictEqual(normalizeTitle("Hello World！(test)－"), "helloworld!(test)-");
    assert.strictEqual(normalizeTitle("No Special Chars"), "nospecialchars");
    assert.strictEqual(normalizeTitle("   Spaces   ! ? ( ) -"), "spaces!?()-");
    assert.strictEqual(normalizeTitle(""), "");
    assert.strictEqual(normalizeTitle(null), "");
});

test('normalizeArtist correctly normalizes artists', (t) => {
    assert.strictEqual(normalizeArtist("Artist1 & Artist2"), "artist1artist2");
    assert.strictEqual(normalizeArtist("Singer (feat. Guest)"), "singer");
    assert.strictEqual(normalizeArtist("Voice Actor CV: Name"), "voiceactorname");
    assert.strictEqual(normalizeArtist("One,Two，Three、Four"), "onetwothreefour");
    assert.strictEqual(normalizeArtist("   Artist   "), "artist");
    assert.strictEqual(normalizeArtist(""), "");
    assert.strictEqual(normalizeArtist(null), "");
});
