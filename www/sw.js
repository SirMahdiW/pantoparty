/* سرویس‌ورکر ادابازی — کش آفلاین
 * نکته: با هر انتشار نام CACHE را یکی زیاد کنید تا کش قبلی پاک شود.
 * کلیدهای کش شامل ?v= هستند ⇒ نسخه‌ی جدید بلافاصله اعمال می‌شود.
 */
var CACHE = 'adabazi-v6';

var ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/tokens.css',
  'css/app.css',
  'js/icons.js',
  'js/assets3d.js',
  'js/store.js',
  'js/audio.js',
  'js/data.js',
  'js/confetti.js',
  'js/game.js',
  'js/app.js',
  'data/words.json',
  'icons/icon-app.png',
  'icons/icon-brand.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'fonts/fonts.css',
  'fonts/Vazirmatn-arabic.woff2',
  'fonts/Vazirmatn-latin.woff2',
  'fonts/PlexArabic-500-arabic.woff2',
  'fonts/PlexArabic-500-latin.woff2',
  'fonts/PlexArabic-500-latin-ext.woff2',
  'fonts/PlexArabic-600-arabic.woff2',
  'fonts/PlexArabic-600-latin.woff2',
  'fonts/PlexArabic-600-latin-ext.woff2',
  'fonts/PlexArabic-700-arabic.woff2',
  'fonts/PlexArabic-700-latin.woff2',
  'fonts/PlexArabic-700-latin-ext.woff2',
  'fonts/Lalezar-arabic.woff2',
  'fonts/Lalezar-latin.woff2',
  'assets/3d/portal-ring.webp',
  'assets/3d/scroll.webp',
  'assets/3d/explosion.webp',
  'assets/3d/lightning.webp',
  'assets/3d/book.webp',
  'assets/3d/heart.webp',
  'assets/3d/token.webp',
  'assets/3d/star.webp',
  'assets/3d/crosshair.webp',
  'assets/3d/hourglass.webp',
  'assets/3d/rounds.webp',
  'assets/3d/trophy.webp',
  'assets/3d/crown.webp',
  'assets/3d/home.webp',
  'assets/3d/cog.webp'
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
  if (url.origin !== location.origin) return;   /* فایل‌های بیرونی: فقط شبکه */

  /* صفحه‌ها: اول شبکه (نسخه‌ی جدید فوراً بیاید)، در صورت قطعی از کش */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match('index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  /* دارایی‌ها: کلید دقیق (با ?v=) — بدون ignoreSearch تا نسخه‌ی کهنه سرو نشود */
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') {
            c.put(req, res.clone());
          }
          return res;
        }).catch(function () { return hit; });

        if (hit) {
          /* از کش پاسخ بده و در پس‌زمینه تازه کن */
          net.catch(function () {});
          return hit;
        }
        /* اگر نسخه‌ی دقیق نبود (مثلاً اولین بازدید): نسخه‌ی بدون پارامتر (آفلاین) */
        return c.match(url.origin + url.pathname).then(function (lo) {
          if (lo) { net.catch(function () {}); return lo; }
          return net;
        });
      });
    })
  );
});
