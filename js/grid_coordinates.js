const GridCoordinates = (() => {
  function supports(conf) {
    return Boolean(conf?.grid && conf.size && conf.corner);
  }

  function screenAddress(x, y, prefix = 'O', origin = [5, 5]) {
    const signed = value => `${value < 0 ? '-' : '+'}${String(Math.abs(value)).padStart(2, '0')}`;
    return prefix + signed(x - origin[0]) + signed(y - origin[1]);
  }

  function address(conf, latlng) {
    if (!supports(conf)) return null;

    const x = Math.floor(latlng.lng - (conf.corner[0] - 0.5));
    const y = Math.floor(latlng.lat - (conf.corner[1] - 0.5));
    const [width, height] = conf.size;
    const [screenWidth, screenHeight] = conf.grid;
    if (x < 0 || y < 0 || x >= width || y >= height) return null;

    return screenAddress(Math.floor(x / screenWidth), Math.floor(y / screenHeight), conf.addressPrefix, conf.addressOrigin)
      + String.fromCharCode(65 + x % screenWidth, 65 + y % screenHeight);
  }

  function screen(conf, latlng) {
    return address(conf, latlng)?.slice(0, -2) ?? null;
  }

  function screens(conf) {
    if (!supports(conf)) return [];
    const [width, height] = conf.size;
    const [screenWidth, screenHeight] = conf.grid;
    const [left, bottom] = conf.corner.map(value => value - 0.5);
    const result = [];
    for (let y = 0; y < Math.ceil(height / screenHeight); y++) {
      for (let x = 0; x < Math.ceil(width / screenWidth); x++) {
        result.push({
          address: screenAddress(x, y, conf.addressPrefix, conf.addressOrigin),
          bounds: [
            [bottom + y * screenHeight, left + x * screenWidth],
            [bottom + Math.min((y + 1) * screenHeight, height), left + Math.min((x + 1) * screenWidth, width)],
          ],
        });
      }
    }
    return result;
  }

  return { supports, screenAddress, address, screen, screens };
})();

if (typeof module !== 'undefined') module.exports = GridCoordinates;
