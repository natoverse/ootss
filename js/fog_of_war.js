const FogOfWar = (() => {
  const coordinates = typeof module === 'undefined' ? GridCoordinates : require('./grid_coordinates.js');

  function initialize(settings) {
    settings.fogOfWar ??= true;
    settings.revealedScreens ??= {};
    const prefixes = ['O', 'OH', 'OL', 'I', 'S', 'M', 'MH', 'ML'];
    for (const [key, revealed] of Object.entries(settings.revealedScreens)) {
      const match = key.match(/^([A-Z]{1,2})([+-]\d+)([+-]\d+)$/);
      if (!match) continue;
      const prefix = { H: 'OH', L: 'OL' }[match[1]] ?? match[1];
      if (!prefixes.includes(prefix)) continue;
      const canonical = coordinates.screenAddress(Number(match[2]), Number(match[3]), prefix, [0, 0]);
      if (canonical !== key) {
        if (!Object.hasOwn(settings.revealedScreens, canonical)) settings.revealedScreens[canonical] = revealed;
        delete settings.revealedScreens[key];
      }
    }
    for (const prefix of prefixes) {
      const origin = `${prefix}+00+00`;
      if (!Object.hasOwn(settings.revealedScreens, origin)) settings.revealedScreens[origin] = true;
    }
  }

  function isObscured(settings, screen) {
    return settings.fogOfWar && screen !== null && settings.revealedScreens[screen] !== true;
  }

  function setLayerRevealed(settings, conf, revealed) {
    const origin = `${conf.addressPrefix}+00+00`;
    for (const { address } of coordinates.screens(conf)) {
      settings.revealedScreens[address] = revealed || address === origin;
    }
  }

  return { initialize, isObscured, setLayerRevealed };
})();

if (typeof module !== 'undefined') module.exports = FogOfWar;
