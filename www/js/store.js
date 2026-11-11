/* ذخیره‌سازی محلی: تنظیمات، تاریخچه، آمار — فقط localStorage */
(function (global) {
  'use strict';

  var KEY = 'adabazi.v1';

  var DEFAULTS = {
    settings: {
      rounds: 3,          // تعداد دور
      roundTime: 60,      // ثانیه هر نوبت
      wordsPerTurn: 5,    // کلمه در هر نوبت
      timeReward: true,   // پاداش زمان باقی‌مانده
      sound: true,
      haptics: true,
      teamNames: ['قرمز', 'آبی'],
      teamColors: [1, 2]
    },
    stats: {
      games: 0,
      words: 0,
      best: null,         // {team, score, date}
      byMode: { adabazi: 0, boom: 0, songs: 0 }
    },
    history: []           // {mode, winner, score, date, words}
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      var parsed = JSON.parse(raw);
      return {
        settings: Object.assign(clone(DEFAULTS.settings), parsed.settings || {}),
        stats: Object.assign(clone(DEFAULTS.stats), parsed.stats || {}),
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    } catch (e) {
      return clone(DEFAULTS);
    }
  }

  var state = read();

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* حافظه پر */ }
  }

  var Store = {
    get settings() { return state.settings; },
    get stats() { return state.stats; },
    get history() { return state.history; },

    setSetting: function (k, v) { state.settings[k] = v; write(); },

    setTeams: function (names, colors) {
      state.settings.teamNames = names;
      state.settings.teamColors = colors;
      write();
    },

    addGame: function (rec) {
      state.stats.games++;
      state.stats.words += rec.words || 0;
      state.stats.byMode[rec.mode] = (state.stats.byMode[rec.mode] || 0) + 1;
      if (!state.stats.best || rec.score > state.stats.best.score) {
        state.stats.best = { team: rec.winner, score: rec.score, date: Date.now() };
      }
      state.history.unshift(rec);
      if (state.history.length > 30) state.history.length = 30;
      write();
    },

    clearHistory: function () {
      state.history = [];
      state.stats = clone(DEFAULTS.stats);
      write();
    },

    reset: function () {
      state = clone(DEFAULTS);
      write();
    }
  };

  global.Store = Store;
})(window);
