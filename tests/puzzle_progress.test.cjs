const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Index } = require('../js/puzzle_progress.js');

const conf = { corner: [-24, -2], size: [190, 156], grid: [19, 13], addressPrefix: 'O', addressOrigin: [5, 5] };
const feature = (name, x, y, layer = 'overworld', type = 'Level_Entry') => ({
  properties: { type, name, layer }, geometry: { coordinates: [x, y, 0] },
});
const progress = new Index({
  configs: { overworld: conf, overworld_high: { ...conf, addressPrefix: 'OH' } },
  features: [
    feature('First@location', 80, 69), feature('First@mirror', 81, 69),
    feature('Second', 82, 69), feature('Neighbor', 90, 69),
    feature('Sky', 80, 69, 'overworld_high'), feature('Freezer', 83, 69, 'overworld', 'Freezer'),
  ],
  layerForFeature: feature => feature.properties.layer,
  completionId: name => name.split('@')[0],
});

test('a partial screen checks all puzzles; undoing one leaves the others solved', () => {
  const marked = { First: true, Neighbor: true };
  assert.deepEqual(progress.screenState('O+00+00', marked), { count: 2, checked: false, indeterminate: true });
  progress.setScreenSolved('O+00+00', marked, true);
  assert.deepEqual(marked, { First: true, Second: true, Neighbor: true });
  assert.deepEqual(progress.screenState('O+00+00', marked), { count: 2, checked: true, indeterminate: false });
  delete marked.Second;
  assert.deepEqual(progress.screenState('O+00+00', marked), { count: 2, checked: false, indeterminate: true });
  assert.equal(marked.First, true);
});

test('clearing a screen affects only its puzzles, not neighboring screens, layers or objects', () => {
  const marked = { First: true, Second: true, Neighbor: true, Sky: true, Freezer: true };
  progress.setScreenSolved('O+00+00', marked, false);
  assert.deepEqual(marked, { Neighbor: true, Sky: true, Freezer: true });
  assert.deepEqual(progress.screenState('O+00+00', marked), { count: 2, checked: false, indeterminate: false });
  assert.deepEqual(progress.screenState('OH+00+00', marked), { count: 1, checked: true, indeterminate: false });
  assert.deepEqual(progress.screenState('O+03+03', marked), { count: 0, checked: false, indeterminate: false });
  assert.throws(() => progress.setScreenSolved('O+03+03', marked, true), /no puzzles/);
});

test('bulk completion persists in the existing markedItems JSON without another aggregate flag', () => {
  const settings = { markedItems: {}, fogOfWar: true, revealedScreens: { 'O+00+00': true } };
  progress.setScreenSolved('O+00+00', settings.markedItems, true);
  const restored = JSON.parse(JSON.stringify(settings));
  assert.deepEqual(progress.screenState('O+00+00', restored.markedItems), { count: 2, checked: true, indeterminate: false });
  assert.equal(restored.fogOfWar, true);
  assert.deepEqual(restored.revealedScreens, { 'O+00+00': true });
});
