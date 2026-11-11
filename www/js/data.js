/* بارگذاری تنبل و یک‌باره دیتای بازی از data/words.json */
(function (global) {
  'use strict';

  var cache = null;
  var pending = null;

  function load() {
    if (cache) return Promise.resolve(cache);
    if (pending) return pending;

    pending = fetch('data/words.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        cache = normalize(json);
        pending = null;
        return cache;
      })
      .catch(function (e) {
        pending = null;
        throw e;
      });

    return pending;
  }

  function normalize(json) {
    var cats = (json.categories || []).slice();
    // فقط دسته‌های «کلمات» با محتوا (cid از ۷۰ به بالا؛ ۵۰ = ضرب‌المثل حالت مستقل است)
    var groups = json.adabazi || {};
    var usable = cats.filter(function (c) { return c.cid >= 70 && groups[String(c.cid)]; });

    return {
      categories: cats,
      usableCategories: usable,
      adabazi: groups,
      boom: json.boom || [],
      songs: json.songs || [],

      countFor: function (cat) {
        var g = groups[String(cat.cid)];
        return g ? g.length : 0;
      },
      totals: {
        adabazi: Object.keys(groups).reduce(function (n, k) {
          return k === '50' ? n : n + groups[k].length;
        }, 0),
        proverb: (groups['50'] || []).length,
        boom: (json.boom || []).length,
        songs: (json.songs || []).length
      }
    };
  }

  global.GameData = { load: load };
})(window);
