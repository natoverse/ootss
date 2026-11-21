const PuzzleProgress = (() => {
  const coordinates = typeof module === 'undefined' ? GridCoordinates : require('./grid_coordinates.js');
  const fog = typeof module === 'undefined' ? FogOfWar : require('./fog_of_war.js');

  class Index {
    constructor({ configs, features, layerForFeature, completionId }) {
      this.cells = new Map();
      this.screens = new Map();
      for (const feature of features) {
        if (feature.properties.type !== 'Level_Entry') continue;
        const conf = configs[layerForFeature(feature)];
        const [lng, lat] = feature.geometry.coordinates;
        const address = coordinates.address(conf, { lat, lng });
        if (!address) continue;
        const screen = address.slice(0, -2);
        const id = completionId(feature.properties.name);
        for (const [index, key] of [[this.cells, address], [this.screens, screen]]) {
          if (!index.has(key)) index.set(key, new Set());
          index.get(key).add(id);
        }
      }
    }

    screenState(screen, markedItems) {
      const ids = this.screens.get(screen) || new Set();
      const solved = [...ids].filter(id => markedItems[id] === true).length;
      return {
        count: ids.size,
        checked: ids.size > 0 && solved === ids.size,
        indeterminate: solved > 0 && solved < ids.size,
      };
    }

    unsolvedCells(conf, settings) {
      const result = [];
      for (const [address, ids] of this.cells) {
        const cell = coordinates.resolve(conf, address);
        if (cell && !fog.isObscured(settings, cell.screen)
          && [...ids].some(id => settings.markedItems?.[id] !== true)) {
          result.push(cell);
        }
      }
      return result;
    }

    setScreenSolved(screen, markedItems, solved) {
      const ids = this.screens.get(screen);
      if (!ids?.size) throw new Error('This screen has no puzzles to mark.');
      for (const id of ids) {
        if (solved) markedItems[id] = true;
        else delete markedItems[id];
      }
    }
  }

  return { Index };
})();

if (typeof module !== 'undefined') module.exports = PuzzleProgress;
