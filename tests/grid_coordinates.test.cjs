const assert = require('node:assert/strict');
const { test } = require('node:test');
const { address, screenAddress } = require('../js/grid_coordinates.js');

const overworld = {
  group: 'overworld',
  corner: [-24, -2],
  size: [190, 156],
  grid: [19, 13],
};

const cell = (x, y) => ({ lng: overworld.corner[0] + x, lat: overworld.corner[1] + y });

test('Crossroads uses signed zero and its center is JG', () => {
  assert.equal(address(overworld, cell(5 * 19 + 9, 5 * 13 + 6)), '+0+0JG');
  assert.equal(address(overworld, cell(5 * 19, 5 * 13)), '+0+0AA');
  assert.equal(address(overworld, cell(6 * 19 - 1, 6 * 13 - 1)), '+0+0SM');
});

test('screen and nested coordinates increase right and up', () => {
  assert.equal(address(overworld, cell(4 * 19 + 18, 5 * 13)), '-1+0SA');
  assert.equal(address(overworld, cell(6 * 19, 5 * 13)), '+1+0AA');
  assert.equal(address(overworld, cell(5 * 19, 4 * 13 + 12)), '+0-1AM');
  assert.equal(address(overworld, cell(5 * 19, 6 * 13)), '+0+1AA');
  assert.equal(address(overworld, cell(0, 0)), '-5-5AA');
  assert.equal(address(overworld, cell(189, 155)), '+4+6SM');
});

test('every one of the 29,640 cells has a unique address', () => {
  const addresses = new Set();
  for (let y = 0; y < 156; y++) {
    for (let x = 0; x < 190; x++) {
      addresses.add(address(overworld, cell(x, y)));
    }
  }
  assert.equal(addresses.size, 190 * 156);
  assert.ok(!addresses.has(null));
});

test('cell edges use the existing half-unit grid boundaries', () => {
  assert.equal(address(overworld, { lng: 70.5, lat: 62.5 }), '+0+0AA');
  assert.equal(address(overworld, { lng: 71.499, lat: 63.499 }), '+0+0AA');
  assert.equal(address(overworld, { lng: 71.5, lat: 63.5 }), '+0+0BB');
  assert.equal(address(overworld, { lng: 70.499, lat: 62.499 }), '-1-1SM');
  assert.equal(address(overworld, { lng: -24.5, lat: -2.5 }), '-5-5AA');
  assert.equal(address(overworld, { lng: -24.501, lat: -2.5 }), null);
  assert.equal(address(overworld, { lng: -24.5, lat: -2.501 }), null);
  assert.equal(address(overworld, { lng: 165.5, lat: 0 }), null);
  assert.equal(address(overworld, { lng: 0, lat: 153.5 }), null);
});

test('the coordinate scheme applies to all three full overworld layers only', () => {
  assert.equal(address({ ...overworld, heightRange: [10, 75] }, cell(104, 71)), '+0+0JG');
  assert.equal(address({ ...overworld, heightRange: [-57, -4] }, cell(104, 71)), '+0+0JG');
  assert.equal(address({ ...overworld, group: 'intro' }, cell(104, 71)), null);
  assert.equal(address({ ...overworld, overlay: true }, cell(104, 71)), null);
});

test('screen labels always include both signs', () => {
  assert.equal(screenAddress(5, 5), '+0+0');
  assert.equal(screenAddress(0, 11), '-5+6');
});
