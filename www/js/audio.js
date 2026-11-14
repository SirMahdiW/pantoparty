/* صداهای بازی با WebAudio — بوق، خطا، پایان، برد. بدون فایل صوتی. */
(function (global) {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ac() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') {
      try {
        var p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () { /* تا اولین لمس بی‌صدا */ });
      } catch (e) { /* بی‌صدا ادامه بده */ }
    }
    return ctx;
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!enabled) return;
    var a = ac();
    if (!a) return;
    try {
      var t0 = a.currentTime + (when || 0);
      var osc = a.createOscillator();
      var g = a.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(a.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) { /* بی‌صدا ادامه بده */ }
  }

  var Audio_ = {
    setEnabled: function (v) { enabled = !!v; },
    get enabled() { return enabled; },

    unlock: function () { ac(); },

    correct: function () {
      tone(660, 0.12, 'triangle', 0.14);
      tone(880, 0.16, 'triangle', 0.12, 0.08);
    },
    wrong: function () {
      tone(200, 0.22, 'sawtooth', 0.08, 0, 120);
    },
    skip: function () {
      tone(440, 0.1, 'square', 0.06);
    },
    tick: function () {
      tone(1100, 0.05, 'square', 0.05);
    },
    start: function () {
      tone(523, 0.1, 'triangle', 0.12);
      tone(659, 0.1, 'triangle', 0.12, 0.1);
      tone(784, 0.16, 'triangle', 0.12, 0.2);
    },
    end: function () {
      tone(784, 0.14, 'triangle', 0.13);
      tone(659, 0.14, 'triangle', 0.13, 0.13);
      tone(523, 0.22, 'triangle', 0.13, 0.26);
    },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, 0.2, 'triangle', 0.14, i * 0.12);
      });
      tone(1319, 0.5, 'sine', 0.1, 0.5);
    },
    click: function () { tone(700, 0.05, 'sine', 0.07); }
  };

  global.GameAudio = Audio_;
})(window);
