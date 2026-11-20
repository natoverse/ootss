const GridCoordinates = (() => {
  const origin = [5, 5];

  function supports(conf) {
    return conf?.group === 'overworld' && !conf.overlay;
  }

  function screenAddress(x, y, prefix = 'O') {
    const signed = value => `${value >= 0 ? '+' : ''}${value}`;
    return prefix + signed(x - origin[0]) + signed(y - origin[1]);
  }

  function address(conf, latlng) {
    if (!supports(conf)) return null;

    const x = Math.floor(latlng.lng - (conf.corner[0] - 0.5));
    const y = Math.floor(latlng.lat - (conf.corner[1] - 0.5));
    const [width, height] = conf.size;
    const [screenWidth, screenHeight] = conf.grid;
    if (x < 0 || y < 0 || x >= width || y >= height) return null;

    return screenAddress(Math.floor(x / screenWidth), Math.floor(y / screenHeight), conf.addressPrefix)
      + String.fromCharCode(65 + x % screenWidth, 65 + y % screenHeight);
  }

  function screen(conf, latlng) {
    return address(conf, latlng)?.slice(0, -2) ?? null;
  }

  return { supports, screenAddress, address, screen };
})();

if (typeof module !== 'undefined') module.exports = GridCoordinates;
