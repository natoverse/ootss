const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Model, Panel } = require('../js/message_board.js');
const { Index } = require('../js/puzzle_progress.js');

const conf = { corner: [-24, -2], size: [190, 156], grid: [19, 13], addressPrefix: 'O', addressOrigin: [5, 5] };
const feature = (name, x, y, layer = 'overworld', type = 'Level_Entry') => ({
  properties: { type, name, layer, id: name, ...(type === 'Teleporter' ? { target_id: 'Marker' } : {}) },
  geometry: { coordinates: [x, y, 0] },
});
const configs = { overworld: conf, overworld_high: { ...conf, addressPrefix: 'OH' } };
const progress = new Index({
  configs,
  features: [
    feature('Puzzle@area', 80, 69), feature('Another', 80, 69), feature('Sky', 80, 69, 'overworld_high'),
    ...['Freezer', 'Teleporter', 'Marker', 'Voice_Log', 'Treasure', 'Sign']
      .map((type, i) => feature(type, 81 + i, 69, 'overworld', type)),
    feature('Area label', 87, 69, 'overworld', 'Area_Pin'),
    feature('Unused anchor', 88, 69, 'overworld', 'Marker'),
    feature('Outside', -25, 69),
  ],
  layerForFeature: feature => feature.properties.layer,
  completionId: name => name.split('@')[0],
});
const model = new Model({ configs, progress });

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

test('discussions require a mapped object, not an empty cell or area label', () => {
  for (const column of 'JKLMNOP') assert.equal(model.canDiscuss(`O+00+00${column}G`), true);
  assert.equal(model.canDiscuss('o-0+0kg'), true);
  assert.equal(model.canDiscuss('OH+00+00JG'), true);
  for (const address of ['O+00+00QG', 'O+00+00RG', 'O+00+00SG', 'OH+00+00KG', 'O+99+99AA', 'general']) {
    assert.equal(model.canDiscuss(address), false, address);
  }
  assert.equal(model.resolve('O+00+00SG').address, 'O+00+00SG', 'Old empty-cell messages retain their coordinates and spoiler checks');
});

test('posting to an empty cell is rejected without losing its draft', async () => {
  const drafts = new Map([['O+00+00SG', 'Keep this draft']]);
  let failure;
  await Panel.prototype.send.call({
    boardId: () => 'O+00+00SG',
    drafts, model, sending: false,
    account: { user: {}, client: { messages: { send: () => assert.fail('An empty-cell post must not reach Firestore') } } },
    showError: error => { failure = error; },
  });
  assert.match(failure.message, /cells containing map objects/);
  assert.equal(drafts.get('O+00+00SG'), 'Keep this draft');
});
