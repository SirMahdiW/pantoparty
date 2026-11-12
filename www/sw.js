/* سرویس‌ورکر ادابازی — کش آفلاین
 * با هر انتشار نسخه‌ی کش (CACHE) را یکی زیاد کنید تا کش قدیمی پاک شود.
 */
var CACHE = 'adabazi-v3';

var ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/tokens.css',
  'css/app.css',
  'js/icons.js',
  'js/store.js',
  'js/audio.js',
  'js/data.js',
  'js/confetti.js',
  'js/game.js',
  'js/app.js',
  'data/words.json',
  'icons/icon-app.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'fonts/fonts.css',
  'fonts/Vazirmatn-arabic.woff2',
  'fonts/Vazirmatn-latin.woff2',
  'fonts/PlexArabic-500-arabic.woff2',
  'fonts/PlexArabic-600-arabic.woff2',
  'fonts/PlexArabic-700-arabic.woff2',
  'fonts/Lalezar-arabic.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  /* فایل‌های بیرونی: فقط از شبکه */
  if (url.origin !== location.origin) return;

  /* صفحه‌ها: اول شبکه، در صورت قطعی از کش */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () { return caches.match('index.html'); })
    );
    return;
  }

  /* دارایی‌ها: از کش، سپس به‌روزرسانی در پس‌زمینه */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
