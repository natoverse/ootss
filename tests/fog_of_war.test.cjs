const assert = require('node:assert/strict');
const { test } = require('node:test');
const { initialize, isObscured } = require('../js/fog_of_war.js');

test('older settings start with fog enabled and only Crossroads clear on each layer', () => {
  const settings = { markedItems: { puzzle: true }, activeLayers: { grid: true } };
  initialize(settings);
  for (const prefix of ['O', 'H', 'L']) {
    assert.equal(isObscured(settings, `${prefix}+0+0`), false);
    assert.equal(isObscured(settings, `${prefix}+1+0`), true);
    assert.equal(isObscured(settings, `${prefix}-5+6`), true);
  }
  assert.deepEqual(settings.markedItems, { puzzle: true });
  assert.deepEqual(settings.activeLayers, { grid: true });
  assert.equal(isObscured(settings, null), false);
});

test('screen progress is independent across layers and can re-obscure Crossroads', () => {
  const settings = {};
  initialize(settings);
  settings.revealedScreens['O+1+0'] = true;
  settings.revealedScreens['O+0+0'] = false;
  assert.equal(isObscured(settings, 'O+1+0'), false);
  assert.equal(isObscured(settings, 'H+1+0'), true);
  assert.equal(isObscured(settings, 'L+1+0'), true);
  assert.equal(isObscured(settings, 'O+0+0'), true);
  assert.equal(isObscured(settings, 'H+0+0'), false);
});

test('turning fog off preserves exploration and restoring it restores coverage', () => {
  const settings = {};
  initialize(settings);
  settings.revealedScreens['H-2+3'] = true;
  settings.fogOfWar = false;
  assert.equal(isObscured(settings, 'O+1+0'), false);
  initialize(settings);
  assert.equal(settings.fogOfWar, false);
  settings.fogOfWar = true;
  assert.equal(isObscured(settings, 'O+1+0'), true);
  assert.equal(isObscured(settings, 'H-2+3'), false);
});

test('settings JSON round-trip preserves fog choices and completed levels', () => {
  const settings = { markedItems: { puzzle: true } };
  initialize(settings);
  settings.fogOfWar = false;
  settings.revealedScreens['L+4+6'] = true;
  settings.revealedScreens['O+0+0'] = false;
  const imported = JSON.parse(JSON.stringify(settings));
  initialize(imported);
  assert.deepEqual(imported, settings);
  imported.fogOfWar = true;
  assert.equal(isObscured(imported, 'L+4+6'), false);
  assert.equal(isObscured(imported, 'O+0+0'), true);
});
