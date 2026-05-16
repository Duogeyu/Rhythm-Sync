const test = require('node:test');
const assert = require('node:assert');
const { normalizeTitle, normalizeArtist } = require('./utils');

test('normalizeTitle works as expected', (t) => {
    assert.strictEqual(normalizeTitle('Test Title!（With parens）- and spaces?'), 'testtitle!(withparens)-andspaces?');
    assert.strictEqual(normalizeTitle(''), '');
    assert.strictEqual(normalizeTitle(null), '');
});

test('normalizeArtist works as expected', (t) => {
    assert.strictEqual(normalizeArtist('Artist Name feat. Guest (CV: Actor) & Someone, Else'), 'artistnameguestsomeoneelse');
    assert.strictEqual(normalizeArtist(''), '');
    assert.strictEqual(normalizeArtist(null), '');
});
