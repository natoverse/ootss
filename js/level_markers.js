const LevelMarkers = (() => {
  function layout(map, latlng) {
    const center = map.project(latlng);
    const right = map.project({ lat: latlng.lat, lng: latlng.lng + 1 });
    const top = map.project({ lat: latlng.lat + 1, lng: latlng.lng });
    const width = Math.hypot(right.x - center.x, right.y - center.y);
    const height = Math.hypot(top.x - center.x, top.y - center.y);
    const size = Math.min(width, height) * 0.9;
    return {
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
      tooltipAnchor: [0, -size / 2],
    };
  }

  function resize(marker, map) {
    const options = layout(map, marker.getLatLng());
    Object.assign(marker.options.icon.options, options);
    const element = marker.getElement();
    if (!element) return;
    const size = options.iconSize[0];
    Object.assign(element.style, {
      width: `${size}px`,
      height: `${size}px`,
      marginLeft: `${-size / 2}px`,
      marginTop: `${-size / 2}px`,
    });
    element.style.setProperty('--level-symbol-size', `${Math.min(20, size * 0.4)}px`);
    element.classList.toggle('level-marker-readable', size >= 16);
    if (marker.isPopupOpen()) marker.getPopup().update();
  }

  return { layout, resize };
})();

if (typeof module !== 'undefined') module.exports = LevelMarkers;
