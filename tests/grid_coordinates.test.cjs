const assert = require('node:assert/strict');
const { test } = require('node:test');
const { address, screenAddress, screen, screens } = require('../js/grid_coordinates.js');

const overworld = {
  group: 'overworld',
  corner: [-24, -2],
  size: [190, 156],
  grid: [19, 13],
  addressPrefix: 'O',
  addressOrigin: [5, 5],
};

const cell = (x, y) => ({ lng: overworld.corner[0] + x, lat: overworld.corner[1] + y });
const intro = { corner: [0, -21], size: [91, 105], grid: [13, 7], addressPrefix: 'I', addressOrigin: [3, 0] };
const stones = { corner: [-25, -17], size: [126, 101], grid: [9, 6], addressPrefix: 'S', addressOrigin: [5, 13] };
const minimap = { corner: [35, 104], size: [50, 36], grid: [5, 3], overlay: true, addressPrefix: 'M', addressOrigin: [5, 5] };
const maps = [
  overworld,
  { ...overworld, addressPrefix: 'OH' },
  { ...overworld, addressPrefix: 'OL' },
  intro,
  stones,
  minimap,
  { ...minimap, addressPrefix: 'MH' },
  { ...minimap, addressPrefix: 'ML' },
];

test('Crossroads uses signed zero and its center is JG', () => {
  assert.equal(address(overworld, cell(5 * 19 + 9, 5 * 13 + 6)), 'O+00+00JG');
  assert.equal(address(overworld, cell(5 * 19, 5 * 13)), 'O+00+00AA');
  assert.equal(address(overworld, cell(6 * 19 - 1, 6 * 13 - 1)), 'O+00+00SM');
});

test('screen and nested coordinates increase right and up', () => {
  assert.equal(address(overworld, cell(4 * 19 + 18, 5 * 13)), 'O-01+00SA');
  assert.equal(address(overworld, cell(6 * 19, 5 * 13)), 'O+01+00AA');
  assert.equal(address(overworld, cell(5 * 19, 4 * 13 + 12)), 'O+00-01AM');
  assert.equal(address(overworld, cell(5 * 19, 6 * 13)), 'O+00+01AA');
  assert.equal(address(overworld, cell(0, 0)), 'O-05-05AA');
  assert.equal(address(overworld, cell(189, 155)), 'O+04+06SM');
});

test('all cells on all eight maps have unique addresses', () => {
  const addresses = new Set();
  let count = 0;
  for (const conf of maps) {
    for (let y = 0; y < conf.size[1]; y++) {
      for (let x = 0; x < conf.size[0]; x++) {
        addresses.add(address(conf, { lng: conf.corner[0] + x, lat: conf.corner[1] + y }));
        count++;
      }
    }
  }
  assert.equal(addresses.size, count);
  assert.ok(!addresses.has(null));
});

test('cell edges use the existing half-unit grid boundaries', () => {
  assert.equal(address(overworld, { lng: 70.5, lat: 62.5 }), 'O+00+00AA');
  assert.equal(address(overworld, { lng: 71.499, lat: 63.499 }), 'O+00+00AA');
  assert.equal(address(overworld, { lng: 71.5, lat: 63.5 }), 'O+00+00BB');
  assert.equal(address(overworld, { lng: 70.499, lat: 62.499 }), 'O-01-01SM');
  assert.equal(address(overworld, { lng: -24.5, lat: -2.5 }), 'O-05-05AA');
  assert.equal(address(overworld, { lng: -24.501, lat: -2.5 }), null);
  assert.equal(address(overworld, { lng: -24.5, lat: -2.501 }), null);
  assert.equal(address(overworld, { lng: 165.5, lat: 0 }), null);
  assert.equal(address(overworld, { lng: 0, lat: 153.5 }), null);
});

test('each map uses its own entry origin and calibrated inner grid', () => {
  for (const conf of maps) {
    const [ox, oy] = conf.addressOrigin;
    const [w, h] = conf.grid;
    assert.equal(address(conf, { lng: conf.corner[0] + ox * w, lat: conf.corner[1] + oy * h }), `${conf.addressPrefix}+00+00AA`);
  }
  assert.equal(address(intro, { lng: 0, lat: -21 }), 'I-03+00AA');
  assert.equal(address(stones, { lng: -25, lat: -17 }), 'S-05-13AA');
  assert.equal(address(stones, { lng: 100, lat: 83 }), 'S+08+03IE');
  assert.equal(address(minimap, { lng: 39, lat: 106 }), 'M-05-05EC');
  assert.equal(address({}, cell(104, 71)), null);
});

test('screen labels always include both signs', () => {
  assert.equal(screenAddress(5, 5), 'O+00+00');
  assert.equal(screenAddress(0, 11), 'O-05+06');
  assert.equal(screenAddress(0, 0, 'S', [5, 13]), 'S-05-13');
});

test('screen keys retain layer prefixes without nested cell letters', () => {
  assert.equal(screen(overworld, cell(104, 71)), 'O+00+00');
  assert.equal(screen({ ...overworld, addressPrefix: 'OH' }, cell(104, 71)), 'OH+00+00');
  assert.equal(screen({ ...overworld, addressPrefix: 'OL' }, cell(104, 71)), 'OL+00+00');
  assert.equal(screen(overworld, cell(-1, 0)), null);
  assert.equal(screen({}, cell(104, 71)), null);
});

test('partial edge screens are clipped without gaps or area outside the map', () => {
  for (const conf of maps) {
    const all = screens(conf);
    const [w, h] = conf.size;
    const [gw, gh] = conf.grid;
    assert.equal(all.length, Math.ceil(w / gw) * Math.ceil(h / gh));
    let area = 0;
    for (const { address: key, bounds: [[bottom, left], [top, right]] } of all) {
      area += (top - bottom) * (right - left);
      assert.equal(screen(conf, { lng: (left + right) / 2, lat: (bottom + top) / 2 }), key);
      assert.ok(right <= conf.corner[0] - 0.5 + w);
      assert.ok(top <= conf.corner[1] - 0.5 + h);
    }
    assert.equal(area, w * h);
  }
  assert.deepEqual(screens(stones).at(-1), {
    address: 'S+08+03',
    bounds: [[78.5, 91.5], [83.5, 100.5]],
  });
});
