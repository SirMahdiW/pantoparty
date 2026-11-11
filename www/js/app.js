/* پانتوپارتی — منطق و صفحه‌ها (جاوااسکریپت خالص، بدون فریمورک) */
(function () {
  'use strict';

  /* ───────── ثابت‌ها ───────── */
  var CATS = window.WORDS;
  var ORD = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];
  var COLORS = ['#FF6B4A', '#F6C945', '#3FC1A5', '#7C9CFF', '#E873B8', '#9BD04F'];
  var LEVEL = { 1: 'آسان', 2: 'متوسط', 3: 'سخت' };
  var DEFAULTS = { groups: 2, rounds: 3, turnSec: 90, names: [] };
  var LIMITS = { groups: [2, 6], rounds: [1, 10] };
  var app = document.getElementById('app');

  /* ───────── ذخیره‌سازی محلی ───────── */
  function read(k) {
    try { return JSON.parse(localStorage.getItem('pp.' + k)); } catch (e) { return null; }
  }
  function write(k, v) {
    try { localStorage.setItem('pp.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }
  function drop(k) {
    try { localStorage.removeItem('pp.' + k); } catch (e) { /* ignore */ }
  }

  /* ───────── وضعیت ───────── */
  var cfg = Object.assign({}, DEFAULTS, read('cfg') || {});
  var game = read('game');           // { teams:[{name,score}], round, turn, used:[] }
  var screen = 'home';
  var pick = { cat: null, pts: null };
  var final = null;
  var T = blankTurn();

  function blankTurn() {
    return { cat: null, pts: 0, word: '', swaps: 0, total: 0, left: 0, end: 0, id: 0, ok: false };
  }

  /* ───────── ابزارها ───────── */
  function fa(n) {
    var s = String(Math.abs(n)).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; });
    return n < 0 ? '<span dir="ltr">−' + s + '</span>' : s;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function teamName(i) { return (cfg.names[i] || '').trim() || 'گروه ' + ORD[i]; }
  function catById(id) { return CATS.filter(function (c) { return c.id === id; })[0]; }
  function clock(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return fa(m) + ':' + (s < 10 ? '۰' : '') + fa(s);
  }

  var audioCtx = null;
  function beep(freq, ms) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = freq; o.type = 'sine';
      g.gain.value = 0.12;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + ms / 1000);
    } catch (e) { /* ignore */ }
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }

  /* ───────── منطق بازی ───────── */
  function newGame() {
    var teams = [];
    for (var i = 0; i < cfg.groups; i++) teams.push({ name: teamName(i), score: 0 });
    game = { teams: teams, round: 1, turn: 0, used: [] };
    write('game', game);
  }

  function draw(catId, pts) {
    var list = catById(catId).words[pts];
    var key = function (w) { return catId + '|' + pts + '|' + w; };
    var fresh = list.filter(function (w) { return game.used.indexOf(key(w)) < 0; });
    if (!fresh.length) {               // همه‌ی کلمه‌های این سطح استفاده شده‌اند
      game.used = game.used.filter(function (k) { return k.indexOf(catId + '|' + pts + '|') !== 0; });
      fresh = list.slice();
    }
    var w = fresh[Math.floor(Math.random() * fresh.length)];
    game.used.push(key(w));
    write('game', game);
    return w;
  }

  function stopTimer() { clearInterval(T.id); T.id = 0; }

  function startTimer() {
    T.total = cfg.turnSec;
    T.end = Date.now() + T.total * 1000;
    T.left = T.total;
    T.id = setInterval(tick, 250);
  }

  function tick() {
    var left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000));
    if (left !== T.left) {
      T.left = left;
      var t = document.getElementById('time'), b = document.getElementById('bar');
      if (t) t.innerHTML = clock(left);
      if (b) b.style.width = (left / T.total * 100) + '%';
      if (left <= 10) { app.classList.add('hot'); if (left > 0) beep(left <= 3 ? 880 : 660, 90); }
    }
    if (left === 0) { stopTimer(); buzz([200, 100, 200]); beep(300, 500); go('confirm'); }
  }

  function scoreOfTurn() {
    var base = T.ok ? T.pts : 0;
    var swap = -T.swaps;
    var fast = T.ok && T.left >= T.total / 2 ? 1 : 0;
    return { base: base, swap: swap, fast: fast, total: base + swap + fast };
  }

  function finishTurn() {
    var s = scoreOfTurn();
    game.teams[game.turn].score += s.total;
    game.turn++;
    if (game.turn >= game.teams.length) { game.turn = 0; game.round++; }
    if (game.round > cfg.rounds) {
      final = game.teams.slice().sort(function (a, b) { return b.score - a.score; });
      game = null; drop('game');
      go('final');
    } else {
      write('game', game);
      go('board');
    }
  }

  /* ───────── نمای صفحه‌ها ───────── */
  function topbar(backAct, title, extra) {
    return '<header class="topbar">' +
      '<button class="icon-btn" data-act="' + backAct + '" aria-label="بازگشت">' + (backAct === 'quit' ? '✕' : '→') + '</button>' +
      '<h2>' + title + '</h2><span class="icon-btn ghost">' + (extra || '') + '</span></header>';
  }

  function stepper(key, label, val) {
    return '<div class="field"><div class="label">' + label + '</div>' +
      '<div class="stepper">' +
      '<button class="step" data-act="dec" data-k="' + key + '" aria-label="کمتر">−</button>' +
      '<output>' + fa(val) + '</output>' +
      '<button class="step" data-act="inc" data-k="' + key + '" aria-label="بیشتر">+</button>' +
      '</div></div>';
  }

  var VIEWS = {
    home: function () {
      return '<section class="screen home">' +
        '<div class="fan" aria-hidden="true"><span>🔑</span><span>🎭</span><span>🍉</span></div>' +
        '<h1>پانتوپارتی</h1>' +
        '<p class="sub">ادا دربیار، بقیه حدس بزنند</p>' +
        '<div class="stack">' +
        '<button class="btn btn-coral" data-act="new">بازی جدید</button>' +
        (game ? '<button class="btn btn-saffron" data-act="resume">ادامه بازی – دور ' + fa(game.round) + '</button>' : '') +
        '<button class="btn btn-ghost" data-act="rules">راهنما</button>' +
        '</div></section>';
    },

    rules: function () {
      return '<section class="screen">' + topbar('home', 'راهنما') +
        '<div class="panel prose">' +
        '<ol>' +
        '<li>گروه‌ها نوبتی ادا می‌کنند. در هر نوبت یک نفر کلمه را می‌بیند و فقط با ادا و حرکت آن را نشان می‌دهد.</li>' +
        '<li>قبل از هر نوبت دسته و سختی کلمه را انتخاب کنید. کلمه‌ی سخت‌تر، امتیاز بیشتر دارد.</li>' +
        '<li>اگر گروه تا پایان زمان درست حدس بزند، امتیاز کلمه را می‌گیرد.</li>' +
        '<li>اگر نیمی از زمان باقی مانده باشد، یک امتیاز سرعت هم اضافه می‌شود.</li>' +
        '<li>عوض کردن کلمه یک امتیاز کم می‌کند.</li>' +
        '<li>بعد از چند دور، گروهی که بیشترین امتیاز را دارد برنده است.</li>' +
        '</ol></div></section>';
    },

    setup: function () {
      var names = '';
      for (var i = 0; i < cfg.groups; i++) {
        names += '<label class="name-row"><i style="background:' + COLORS[i] + '"></i>' +
          '<input type="text" maxlength="18" data-name="' + i + '" placeholder="گروه ' + ORD[i] + '" value="' + esc(cfg.names[i] || '') + '"></label>';
      }
      var chips = [60, 90, 120].map(function (s) {
        return '<button class="chip' + (cfg.turnSec === s ? ' on' : '') + '" data-act="sec" data-v="' + s + '">' + fa(s) + ' ثانیه</button>';
      }).join('');
      return '<section class="screen">' + topbar('home', 'بازی جدید') +
        '<div class="panel">' +
        stepper('groups', 'تعداد گروه', cfg.groups) +
        stepper('rounds', 'تعداد دور', cfg.rounds) +
        '<div class="field"><div class="label">زمان هر نوبت</div><div class="chips">' + chips + '</div></div>' +
        '<div class="field"><div class="label">نام گروه‌ها</div>' + names + '</div>' +
        '</div>' +
        '<button class="btn btn-saffron sticky" data-act="start">شروع بازی</button></section>';
    },

    board: function () {
      var rows = game.teams.map(function (t, i) {
        var on = i === game.turn;
        return '<li class="team' + (on ? ' on' : '') + '" style="--c:' + COLORS[i] + '">' +
          '<i></i><span class="n">' + esc(t.name) + '</span>' +
          (on ? '<em>نوبت ادا</em>' : '') +
          '<b>' + fa(t.score) + '</b></li>';
      }).join('');
      return '<section class="screen">' + topbar('quit', 'دور ' + fa(game.round) + ' از ' + fa(cfg.rounds)) +
        '<ul class="teams">' + rows + '</ul>' +
        '<button class="btn btn-saffron sticky" data-act="turn">شروع نوبت ' + esc(game.teams[game.turn].name) + '</button></section>';
    },

    pick: function () {
      var cats = CATS.map(function (c) {
        return '<button class="cat' + (pick.cat === c.id ? ' on' : '') + '" data-act="cat" data-v="' + c.id + '">' +
          '<span>' + c.icon + '</span>' + c.name + '</button>';
      }).join('');
      var pts = [1, 2, 3].map(function (p) {
        return '<button class="pt' + (pick.pts === p ? ' on' : '') + '" data-act="pts" data-v="' + p + '">' +
          '<b>' + fa(p) + '</b><small>' + LEVEL[p] + '</small></button>';
      }).join('');
      var ready = pick.cat && pick.pts;
      return '<section class="screen">' + topbar('toBoard', 'انتخاب کلمه') +
        '<h3 class="h">دسته</h3><div class="cats">' + cats + '</div>' +
        '<h3 class="h">امتیاز کلمه</h3><div class="pts">' + pts + '</div>' +
        '<button class="btn btn-saffron sticky" data-act="prepare"' + (ready ? '' : ' disabled') + '>ادامه</button></section>';
    },

    ready: function () {
      return '<section class="screen center">' +
        '<p class="lead">' + esc(game.teams[game.turn].name) + '</p>' +
        '<p class="hint">فقط ادا‌کننده نگاه کند.<br>با لمس چشم، کلمه نمایش داده می‌شود و زمان شروع می‌شود.</p>' +
        '<button class="eye" data-act="reveal" aria-label="نمایش کلمه">👁</button></section>';
    },

    play: function () {
      var c = catById(T.cat);
      return '<section class="screen play">' +
        '<div class="meta">' + c.icon + ' ' + c.name + ' – ' + fa(T.pts) + ' امتیازی</div>' +
        '<div class="time" id="time">' + clock(T.left) + '</div>' +
        '<div class="bar"><i id="bar" style="width:' + (T.left / T.total * 100) + '%"></i></div>' +
        '<div class="word-card"><p id="word">' + esc(T.word) + '</p></div>' +
        '<div class="actions">' +
        '<button class="btn btn-ghost" data-act="swap">عوض کن – <span dir="ltr">−۱</span></button>' +
        '<button class="btn btn-mint" data-act="done">✓ حدس زدند</button>' +
        '</div></section>';
    },

    confirm: function () {
      return '<section class="screen center">' +
        '<div class="word-card small"><p>' + esc(T.word) + '</p></div>' +
        '<h2 class="lead">درست حدس زدند؟</h2>' +
        '<div class="yn"><button class="no" data-act="no" aria-label="نه">✕</button>' +
        '<button class="yes" data-act="yes" aria-label="بله">✓</button></div></section>';
    },

    result: function () {
      var s = scoreOfTurn();
      var row = function (label, v) {
        return '<div class="row"><span>' + label + '</span><b class="' + (v < 0 ? 'neg' : 'pos') + '">' + fa(v) + '</b></div>';
      };
      return '<section class="screen">' +
        '<h2 class="lead center-t">' + esc(game.teams[game.turn].name) + '</h2>' +
        '<div class="panel">' +
        row('امتیاز کلمه', s.base) + row('امتیاز سرعت', s.fast) + row('عوض کردن کلمه', s.swap) +
        '<div class="total ' + (s.total < 0 ? 'bad' : 'good') + '">جمع این نوبت: ' + fa(s.total) + '</div></div>' +
        '<button class="btn btn-saffron sticky" data-act="next">ادامه</button></section>';
    },

    final: function () {
      var top = final[0].score;
      var winners = final.filter(function (t) { return t.score === top; });
      var rows = final.map(function (t, i) {
        return '<li class="team' + (t.score === top ? ' on' : '') + '"><i style="background:' + COLORS[i] + '"></i>' +
          '<span class="n">' + esc(t.name) + '</span><b>' + fa(t.score) + '</b></li>';
      }).join('');
      return '<section class="screen center">' +
        '<div class="cup">🏆</div>' +
        '<h2 class="lead">' + (winners.length > 1 ? 'مساوی!' : 'برنده: ' + esc(winners[0].name)) + '</h2>' +
        '<ul class="teams wide">' + rows + '</ul>' +
        '<div class="stack"><button class="btn btn-saffron" data-act="again">بازی دوباره</button>' +
        '<button class="btn btn-ghost" data-act="home">صفحه‌ی اصلی</button></div></section>';
    }
  };

  /* ───────── رندر و ناوبری ───────── */
  function render(keepScroll) {
    var y = window.scrollY;
    app.innerHTML = VIEWS[screen]();
    app.setAttribute('data-screen', screen);
    if (screen !== 'play') app.classList.remove('hot');
    window.scrollTo(0, keepScroll ? y : 0);
  }
  function go(s) { screen = s; render(false); }

  /* ───────── کنش‌ها ───────── */
  function clampCfg() {
    cfg.groups = Math.min(LIMITS.groups[1], Math.max(LIMITS.groups[0], cfg.groups));
    cfg.rounds = Math.min(LIMITS.rounds[1], Math.max(LIMITS.rounds[0], cfg.rounds));
  }

  var ACT = {
    home: function () { go('home'); },
    rules: function () { go('rules'); },
    new: function () { go('setup'); },
    resume: function () { go('board'); },
    inc: function (el) { cfg[el.dataset.k]++; clampCfg(); write('cfg', cfg); render(true); },
    dec: function (el) { cfg[el.dataset.k]--; clampCfg(); write('cfg', cfg); render(true); },
    sec: function (el) { cfg.turnSec = +el.dataset.v; write('cfg', cfg); render(true); },
    start: function () {
      if (game && !confirm('بازی ذخیره‌شده پاک می‌شود. ادامه می‌دهید؟')) return;
      write('cfg', cfg); newGame(); go('board');
    },
    quit: function () { if (confirm('از بازی خارج می‌شوید؟ بازی ذخیره می‌ماند.')) go('home'); },
    toBoard: function () { go('board'); },
    turn: function () { pick = { cat: null, pts: null }; go('pick'); },
    cat: function (el) { pick.cat = el.dataset.v; render(true); },
    pts: function (el) { pick.pts = +el.dataset.v; render(true); },
    prepare: function () {
      T = blankTurn();
      T.cat = pick.cat; T.pts = pick.pts;
      T.word = draw(T.cat, T.pts);
      T.total = cfg.turnSec; T.left = cfg.turnSec;
      go('ready');
    },
    reveal: function () { startTimer(); go('play'); },
    swap: function () {
      T.swaps++;
      T.word = draw(T.cat, T.pts);
      var w = document.getElementById('word'); if (w) w.textContent = T.word;
    },
    done: function () { stopTimer(); go('confirm'); },
    yes: function () { T.ok = true; go('result'); },
    no: function () { T.ok = false; go('result'); },
    next: function () { finishTurn(); },
    again: function () { newGame(); go('board'); }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var f = ACT[el.dataset.act];
    if (f) { buzz(8); f(el); }
  });

  document.addEventListener('input', function (e) {
    var i = e.target.getAttribute && e.target.getAttribute('data-name');
    if (i !== null && i !== undefined) { cfg.names[+i] = e.target.value; write('cfg', cfg); }
  });

  /* دکمه‌ی بازگشت اندروید (فقط داخل اپ Capacitor) */
  function onBack() {
    var back = { rules: 'home', setup: 'home', board: 'home', pick: 'board', ready: 'pick', final: 'home' };
    if (screen === 'home') {
      var C = window.Capacitor;
      if (C && C.Plugins && C.Plugins.App) C.Plugins.App.exitApp();
    } else if (back[screen]) {
      go(back[screen]);
    }
  }
  (function hookBack() {
    var C = window.Capacitor;
    if (C && C.Plugins && C.Plugins.App) C.Plugins.App.addListener('backButton', onBack);
  })();

  clampCfg();
  render(false);
})();
