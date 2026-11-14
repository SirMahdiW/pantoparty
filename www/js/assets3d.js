/* ============================================================
   ادابازی — آسن‌های سه‌بعدی (رندر شفاف WebP)
   ------------------------------------------------------------
   منبع اصلی و الزامی:
     پک «3D Game UI Icons» در 3dassets.dev
     https://3dassets.dev/packs/game-ui-icon-library
   مجوز: CC0 1.0 Universal
   فایل‌ها به‌صورت محلی در assets/3d/ نگهداری می‌شوند تا بدون اینترنت
   هم کار کنند. هیچ موتور رندر سه‌بعدی در اپ بارگذاری نمی‌شود.
   ============================================================ */
(function (global) {
  'use strict';

  var BASE = 'assets/3d/';

  var FILES = {
    portalRing: 'portal-ring.webp',   /* هیروی صفحه اصلی */
    scroll: 'scroll.webp',             /* حالت ادابازی / ضرب المثل */
    explosion: 'explosion.webp',       /* حالت بوم */
    lightning: 'lightning.webp',       /* دسته سرعتی */
    book: 'book.webp',                 /* دسته کلمه / تاریخچه */
    heart: 'heart.webp',               /* دسته ترانه / درباره */
    token: 'token.webp',               /* انتخاب تصادفی */
    star: 'star.webp',                 /* امتیاز کلمه */
    crosshair: 'crosshair.webp',       /* نوبت سرعتی */
    hourglass: 'hourglass.webp',       /* تنظیم زمان */
    rounds: 'rounds.webp',             /* تعداد دور */
    trophy: 'trophy.webp',             /* برنده بازی */
    crown: 'crown.webp',               /* رتبه اول */
    home: 'home.webp',                 /* بازگشت به خانه */
    cog: 'cog.webp'                    /* تنظیمات */
  };

  var ALT = {
    portalRing: 'حلقه سه‌بعدی بنفش',
    scroll: 'طومار کلمه',
    explosion: 'انفجار',
    lightning: 'برق',
    book: 'کتاب بنفش',
    heart: 'قلب',
    token: 'توکن بنفش',
    star: 'ستاره بنفش',
    crosshair: 'هدف',
    hourglass: 'ساعت شنی',
    rounds: 'دور',
    trophy: 'جام قهرمانی',
    crown: 'تاج قهرمان',
    home: 'خانه',
    cog: 'چرخ‌دنده تنظیمات'
  };

  var A3D = {
    /* مسیر فایل */
    src: function (id) { return BASE + (FILES[id] || ''); },
    /* تگ img آماده (کلاس a3d + اندازه) */
    img: function (id, cls, alt) {
      if (!FILES[id]) return '';
      return '<img class="a3d ' + (cls || '') + '" src="' + BASE + FILES[id] + '" alt="' +
        (alt || ALT[id] || '') + '" width="160" height="160" decoding="async" loading="lazy">';
    }
  };

  global.A3D = A3D;
})(window);
