const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Model } = require('../js/message_board.js');

const conf = { corner: [-24, -2], size: [190, 156], grid: [19, 13], addressPrefix: 'O', addressOrigin: [5, 5] };
const feature = (name, x, y, layer = 'overworld') => ({
  properties: { type: 'Level_Entry', name, layer },
  geometry: { coordinates: [x, y, 0] },
});
const model = new Model({
  configs: { overworld: conf, overworld_high: { ...conf, addressPrefix: 'OH' } },
  features: [feature('Puzzle@area', 80, 69), feature('Another', 80, 69), feature('Sky', 80, 69, 'overworld_high')],
  layerForFeature: feature => feature.properties.layer,
  completionId: name => name.split('@')[0],
});

test('spoilers combine screen exploration with all puzzles at the exact cell', () => {
  const state = { fogOfWar: true, revealedScreens: {}, markedItems: {} };
  assert.deepEqual(model.spoilers('O+00+00JG', state), ['Unexplored screen', 'Unsolved puzzle']);
  state.revealedScreens['O+00+00'] = true;
  assert.deepEqual(model.spoilers('O+00+00JG', state), ['Unsolved puzzle']);
  state.markedItems.Puzzle = true;
  assert.deepEqual(model.spoilers('O+00+00JG', state), ['Unsolved puzzle']);
  state.markedItems.Another = true;
  assert.deepEqual(model.spoilers('O+00+00JG', state), []);
  assert.deepEqual(model.spoilers('OH+00+00JG', state), ['Unexplored screen', 'Unsolved puzzle']);
});

test('turning fog off exposes screens but does not expose unsolved puzzle messages', () => {
  const state = { fogOfWar: false, revealedScreens: {}, markedItems: {} };
  assert.deepEqual(model.spoilers('O+00+00JG', state), ['Unsolved puzzle']);
  assert.deepEqual(model.spoilers('O+00+00KG', state), []);
  assert.deepEqual(model.spoilers('general', { fogOfWar: true }), []);
  assert.deepEqual(model.spoilers('O+99+99AA', state), ['Unknown cell']);
});

test('board navigation keeps layer prefixes and normalizes signed zero', () => {
  assert.equal(model.resolve('oh-0+0jg').layer, 'overworld_high');
  assert.equal(model.resolve('oh-0+0jg').address, 'OH+00+00JG');
  assert.equal(model.resolve('I+00+00AA'), null);
});
