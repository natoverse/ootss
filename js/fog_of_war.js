const FogOfWar = (() => {
  function initialize(settings) {
    settings.fogOfWar ??= true;
    settings.revealedScreens ??= {
      'O+0+0': true,
      'H+0+0': true,
      'L+0+0': true,
    };
  }

  function isObscured(settings, screen) {
    return settings.fogOfWar && screen !== null && settings.revealedScreens[screen] !== true;
  }

  return { initialize, isObscured };
})();

if (typeof module !== 'undefined') module.exports = FogOfWar;
