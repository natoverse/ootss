const assert = require('node:assert/strict');
const { test } = require('node:test');
const { initialize, isObscured } = require('../js/fog_of_war.js');

test('older settings start with fog enabled and only the entry screen clear on each layer', () => {
  const settings = { markedItems: { puzzle: true }, activeLayers: { grid: true } };
  initialize(settings);
  for (const prefix of ['O', 'OH', 'OL', 'I', 'S', 'M', 'MH', 'ML']) {
    assert.equal(isObscured(settings, `${prefix}+00+00`), false);
    assert.equal(isObscured(settings, `${prefix}+01+00`), true);
    assert.equal(isObscured(settings, `${prefix}-05+06`), true);
  }
  assert.deepEqual(settings.markedItems, { puzzle: true });
  assert.deepEqual(settings.activeLayers, { grid: true });
  assert.equal(isObscured(settings, null), false);
});

test('screen progress is independent across layers and can re-obscure Crossroads', () => {
  const settings = {};
  initialize(settings);
  settings.revealedScreens['O+01+00'] = true;
  settings.revealedScreens['O+00+00'] = false;
  assert.equal(isObscured(settings, 'O+01+00'), false);
  assert.equal(isObscured(settings, 'OH+01+00'), true);
  assert.equal(isObscured(settings, 'OL+01+00'), true);
  assert.equal(isObscured(settings, 'O+00+00'), true);
  assert.equal(isObscured(settings, 'OH+00+00'), false);
});

test('turning fog off preserves exploration and restoring it restores coverage', () => {
  const settings = {};
  initialize(settings);
  settings.revealedScreens['OH-02+03'] = true;
  settings.fogOfWar = false;
  assert.equal(isObscured(settings, 'O+01+00'), false);
  initialize(settings);
  assert.equal(settings.fogOfWar, false);
  settings.fogOfWar = true;
  assert.equal(isObscured(settings, 'O+01+00'), true);
  assert.equal(isObscured(settings, 'OH-02+03'), false);
});

test('settings JSON round-trip preserves fog choices and completed levels', () => {
  const settings = { markedItems: { puzzle: true } };
  initialize(settings);
  settings.fogOfWar = false;
  settings.revealedScreens['OL+04+06'] = true;
  settings.revealedScreens['O+00+00'] = false;
  const imported = JSON.parse(JSON.stringify(settings));
  initialize(imported);
  assert.deepEqual(imported, settings);
  imported.fogOfWar = true;
  assert.equal(isObscured(imported, 'OL+04+06'), false);
  assert.equal(isObscured(imported, 'O+00+00'), true);
});

test('legacy prefixes and single-digit axes migrate without losing explicit fog choices', () => {
  const settings = {
    fogOfWar: false,
    markedItems: { puzzle: true },
    revealedScreens: {
      'O+0+0': false,
      'H-2+3': true,
      'L+4+6': false,
      'H+0+0': false,
      'O-0+1': true,
    },
  };
  initialize(settings);
  assert.equal(settings.fogOfWar, false);
  assert.deepEqual(settings.markedItems, { puzzle: true });
  assert.equal(settings.revealedScreens['O+00+00'], false);
  assert.equal(settings.revealedScreens['OH-02+03'], true);
  assert.equal(settings.revealedScreens['OL+04+06'], false);
  assert.equal(settings.revealedScreens['OH+00+00'], false);
  assert.equal(settings.revealedScreens['O+00+01'], true);
  assert.ok(!Object.hasOwn(settings.revealedScreens, 'H-2+3'));
  assert.ok(!Object.hasOwn(settings.revealedScreens, 'L+4+6'));
  const once = JSON.stringify(settings);
  initialize(settings);
  assert.equal(JSON.stringify(settings), once);
});

test('canonical saved choices take precedence over conflicting legacy keys', () => {
  const settings = { revealedScreens: { 'H+1-2': true, 'OH+01-02': false, 'S+00+00': false } };
  initialize(settings);
  assert.equal(settings.revealedScreens['OH+01-02'], false);
  assert.equal(settings.revealedScreens['S+00+00'], false);
  assert.ok(!Object.hasOwn(settings.revealedScreens, 'H+1-2'));
});
