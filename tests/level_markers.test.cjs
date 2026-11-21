const assert = require('node:assert/strict');
const { test } = require('node:test');
const LevelMarkers = require('../js/level_markers.js');

function projection(zoom = 0, xScale = 4, yScale = xScale) {
  return {
    project: ({ lat, lng }) => ({
      x: 173 + lng * xScale * 2 ** zoom,
      y: -61 - lat * yScale * 2 ** zoom,
    }),
  };
}

test('star icons fit inside one cell and anchor their center, not a pin tip', () => {
  const layout = LevelMarkers.layout(projection(0, 6, 4), { lat: 74, lng: 80 });
  const size = layout.iconSize[0];
  assert.ok(size > 0 && size < 4);
  assert.deepEqual(layout.iconSize, [size, size]);
  assert.deepEqual(layout.iconAnchor, [size / 2, size / 2]);
  assert.deepEqual(layout.popupAnchor, [0, -size / 2]);
  assert.deepEqual(layout.tooltipAnchor, [0, -size / 2]);
});

test('star size follows fractional zoom and the current layer projection', () => {
  const point = { lat: -18, lng: -24 };
  const initial = LevelMarkers.layout(projection(), point).iconSize[0];
  const zoomed = LevelMarkers.layout(projection(2.5), point).iconSize[0];
  assert.ok(Math.abs(zoomed / initial - 2 ** 2.5) < 1e-10);
  const rescaled = LevelMarkers.layout(projection(0, 8), point).iconSize[0];
  assert.ok(Math.abs(rescaled / initial - 2) < 1e-10);
});

test('resizing preserves marker DOM, completion/visibility/selection state, and popup binding', () => {
  const classes = new Set(['level-marker', 'found', 'hidden', 'level-marker-selected']);
  const element = {
    style: { setProperty(name, value) { this[name] = value; } },
    classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
  };
  let popupUpdates = 0;
  const marker = {
    options: { icon: { options: {} } },
    getLatLng: () => ({ lat: 74, lng: 80 }),
    getElement: () => element,
    isPopupOpen: () => true,
    getPopup: () => ({ update() { popupUpdates++; } }),
    setIcon() { throw new Error('Resizing must not recreate marker DOM'); },
  };
  LevelMarkers.resize(marker, projection(4));
  const size = marker.options.icon.options.iconSize[0];
  assert.equal(element.style.width, `${size}px`);
  assert.equal(element.style.height, `${size}px`);
  assert.equal(Number.parseFloat(element.style.marginLeft), -size / 2);
  assert.equal(Number.parseFloat(element.style.marginTop), -size / 2);
  assert.equal(popupUpdates, 1);
  LevelMarkers.resize(marker, projection());
  for (const name of ['found', 'hidden', 'level-marker-selected']) assert.ok(classes.has(name));
});
