/* مجموعه آیکون‌های SVG — stroke 2px، بدون emoji */
(function (global) {
  'use strict';

  var P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  var PATHS = {
    home: '<path ' + P + ' d="M3 10.5 12 3l9 7.5"/><path ' + P + ' d="M5 9.5V21h14V9.5"/><path ' + P + ' d="M9.5 21v-6h5v6"/>',
    play: '<path ' + P + ' d="M7 4.5v15l13-7.5z"/>',
    settings: '<circle ' + P + ' cx="12" cy="12" r="3.2"/><path ' + P + ' d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.08A1.7 1.7 0 0 0 10.1 3.04V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.02H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.02z"/>',
    back: '<path ' + P + ' d="M15 5l-7 7 7 7"/>',
    close: '<path ' + P + ' d="M6 6l12 12M18 6L6 18"/>',
    check: '<path ' + P + ' d="M4.5 12.5l5 5 10-11"/>',
    x: '<path ' + P + ' d="M6 6l12 12M18 6L6 18"/>',
    skip: '<path ' + P + ' d="M5 5v14M19 5v14"/><path ' + P + ' d="M9 12l7-5v10z" fill="currentColor"/>',
    undo: '<path ' + P + ' d="M4 9h9a5 5 0 1 1 0 10H8"/><path ' + P + ' d="M4 9l4-4M4 9l4 4"/>',
    timer: '<circle ' + P + ' cx="12" cy="13.5" r="7.5"/><path ' + P + ' d="M12 9.5v4l2.5 2"/><path ' + P + ' d="M9.5 2.5h5"/>',
    users: '<circle ' + P + ' cx="9" cy="8" r="3.4"/><path ' + P + ' d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path ' + P + ' d="M16 5.2a3.4 3.4 0 0 1 0 6.6"/><path ' + P + ' d="M17.6 14.4A6.2 6.2 0 0 1 21.2 20"/>',
    plus: '<path ' + P + ' d="M12 5v14M5 12h14"/>',
    minus: '<path ' + P + ' d="M5 12h14"/>',
    book: '<path ' + P + ' d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z"/><path ' + P + ' d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 20.5z"/>',
    bolt: '<path ' + P + ' d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
    music: '<path ' + P + ' d="M9 18V5.5l11-2V16"/><circle ' + P + ' cx="6.5" cy="18" r="2.6"/><circle ' + P + ' cx="17.5" cy="16" r="2.6"/>',
    chart: '<path ' + P + ' d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    history: '<path ' + P + ' d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path ' + P + ' d="M3.5 4.5V10H9"/><path ' + P + ' d="M12 7.5V12l3 2"/>',
    info: '<circle ' + P + ' cx="12" cy="12" r="9"/><path ' + P + ' d="M12 11v5.5"/><circle ' + P + ' cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>',
    shield: '<path ' + P + ' d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 10 4.4-1.6 7.5-5.4 7.5-10v-6z"/><path ' + P + ' d="M9 12l2.2 2.2L15.5 9.7"/>',
    star: '<path ' + P + ' d="m12 3 2.7 5.6 6.1.8-4.4 4.3 1.1 6.1L12 17l-5.5 2.8 1.1-6.1L3.2 9.4l6.1-.8z"/>',
    crown: '<path ' + P + ' d="M3 8l4 4 5-7 5 7 4-4-1.5 11H4.5z"/><path ' + P + ' d="M4.5 19h15"/>',
    trophy: '<path ' + P + ' d="M7 4h10v5a5 5 0 0 1-10 0z"/><path ' + P + ' d="M7 6H4.5a0 0 0 0 0 0 0 3 3 0 0 0 3 3"/><path ' + P + ' d="M17 6h2.5a3 3 0 0 1-3 3"/><path ' + P + ' d="M12 14v3"/><path ' + P + ' d="M8.5 21h7"/><path ' + P + ' d="M9.5 17h5v4h-5z"/>',
    dice: '<rect ' + P + ' x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor"/>',
    flag: '<path ' + P + ' d="M5 21V4"/><path ' + P + ' d="M5 4.5h11l-2 4 2 4H5z"/>',
    trash: '<path ' + P + ' d="M4 7h16"/><path ' + P + ' d="M9 7V4.5h6V7"/><path ' + P + ' d="M6 7l1 13.5h10L18 7"/><path ' + P + ' d="M10 11v6M14 11v6"/>',
    download: '<path ' + P + ' d="M12 3.5v11"/><path ' + P + ' d="M7.5 10.5 12 15l4.5-4.5"/><path ' + P + ' d="M4.5 19.5h15"/>',
    share: '<circle ' + P + ' cx="18" cy="5.5" r="2.6"/><circle ' + P + ' cx="6" cy="12" r="2.6"/><circle ' + P + ' cx="18" cy="18.5" r="2.6"/><path ' + P + ' d="M8.3 10.8 15.7 6.7M8.3 13.2l7.4 4.1"/>',
    palette: '<path ' + P + ' d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3 3h-2a2.4 2.4 0 0 0-1.7 4.1c.5.5.2 1.9-2.3 1.9z"/><circle cx="7.8" cy="11.8" r="1.3" fill="currentColor"/><circle cx="10.5" cy="7.6" r="1.3" fill="currentColor"/><circle cx="15.4" cy="8.2" r="1.3" fill="currentColor"/>',
    grid: '<rect ' + P + ' x="3.5" y="3.5" width="7" height="7" rx="2"/><rect ' + P + ' x="13.5" y="3.5" width="7" height="7" rx="2"/><rect ' + P + ' x="3.5" y="13.5" width="7" height="7" rx="2"/><rect ' + P + ' x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    spark: '<path ' + P + ' d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    pause: '<path ' + P + ' d="M8.5 5v14M15.5 5v14"/>',
    play2: '<path ' + P + ' d="M7 4.5v15l13-7.5z"/>',
    refresh: '<path ' + P + ' d="M20 11a8 8 0 1 0-.6 4"/><path ' + P + ' d="M20 4.5V11h-6"/>',
    link: '<path ' + P + ' d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.6 1.6"/><path ' + P + ' d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.6-1.6"/>',
    volume: '<path ' + P + ' d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path ' + P + ' d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path ' + P + ' d="M18.2 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path ' + P + ' d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path ' + P + ' d="M16 9.5l5 5M21 9.5l-5 5"/>',
    edit: '<path ' + P + ' d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z"/><path ' + P + ' d="M14.5 6.5 17.5 9.5"/>',
    layers: '<path ' + P + ' d="m12 3 9 5-9 5-9-5z"/><path ' + P + ' d="m3.5 13 8.5 4.8L20.5 13"/>',
    target: '<circle ' + P + ' cx="12" cy="12" r="8.5"/><circle ' + P + ' cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    heart: '<path ' + P + ' d="M12 20s-7.5-4.7-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.3-7.5 10-7.5 10z"/>',
    eye: '<path ' + P + ' d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><path ' + P + ' d="M12 15a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3 3 3 0 0 0-3 3z"/>',
    swap: '<path ' + P + ' d="M8 7l-5 5 5 5M16 7l5 5-5 5M13 4l-2 6-2-6M11 18l-2-6-2 6"/>'
  };

  function icon(name, cls) {
    var body = PATHS[name] || PATHS.info;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  global.Icons = { get: icon, paths: PATHS };
})(window);
