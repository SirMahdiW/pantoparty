/* اپ اصلی — روتر و صفحات؛ جریان بازی مطابق اپ اصلی ادابازی:
 * ساخت بازی ← صفحه گروه ← انتخاب دسته (هر نوبت) ← بازی یک کلمه ← دیالوگ نتیجه ← صفحه گروه ... ← رتبه‌بندی
 */
(function () {
  'use strict';

  var main = document.getElementById('main');
  var btnBack = document.getElementById('btn-back');
  var btnSettings = document.getElementById('btn-settings');
  var brand = document.getElementById('brand');
  var toastRegion = document.getElementById('toast-region');
  var modalRoot = document.getElementById('modal-root');

  var data = null;
  var engine = null;
  var timerId = null;
  var route = 'home';
  var lastTickShown = null;
  var pendingType = 'adabazi';   // نوع بازی در حال ساخت
  var draft = null;              // تنظیمات ساخت
  var catSel = null;             // {cid, score} انتخاب امتیاز در دیالوگ دسته
  var speedScoreChoice = 1;

  var TYPES = {
    adabazi: {
      title: 'ادابازی',
      desc: 'هر نوبت یک کلمه؛ بقیه حدس می‌زنند.',
      icon: 'book',
      glow: 'linear-gradient(150deg, #7C3AED, #4C1D95)'
    },
    boom: {
      title: 'بوم',
      desc: 'کلمه به کلمه، دست‌به‌دست.',
      icon: 'bolt',
      glow: 'linear-gradient(150deg, #F43F5E, #9F1239)'
    }
  };

  var TEAM_COLORS = [
    { v: '#6D28D9', n: 'بنفش' }, { v: '#E11D48', n: 'قرمز' }, { v: '#0891B2', n: 'آبی' },
    { v: '#2563EB', n: 'نیلی' }, { v: '#16A34A', n: 'سبز' }, { v: '#DB2777', n: 'صورتی' }
  ];

  var FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  function fa(n) {
    return String(n).replace(/\d/g, function (d) { return FA_DIGITS[+d]; });
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return fa(m) + ':' + (s < 10 ? '۰' : '') + fa(s);
  }

  /* ---------------- کمکی‌ها ---------------- */

  function h(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    toastRegion.innerHTML = '';
    var el = h('<div class="toast">' + esc(msg) + '</div>');
    toastRegion.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(14px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 2200);
  }

  function beep(kind) {
    if (!Store.settings.sound) return;
    GameAudio.setEnabled(true);
    if (kind && GameAudio[kind]) GameAudio[kind]();
  }

  function vibrate(ms) {
    if (Store.settings.haptics && navigator.vibrate) navigator.vibrate(ms || 18);
  }

  function modal(opts) {
    var iconStyle = '';
    if (opts.iconColor) {
      var c = opts.iconColor;
      iconStyle = '--orb:' + c + ';';
    }
    var scrim = h(
      '<div class="scrim" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || 'پنجره') + '">' +
      '<div class="sheet">' +
      (opts.icon ? '<div class="sheet-icon" style="' + iconStyle + '">' + Icons.get(opts.icon) + '</div>' : '') +
      '<h2>' + esc(opts.title || '') + '</h2>' +
      (opts.body ? '<div class="sh-body">' + opts.body + '</div>' : '') +
      '<div class="sheet-actions"></div>' +
      '</div></div>'
    );
    var actions = scrim.querySelector('.sheet-actions');
    (opts.actions || [{ label: 'باشه' }]).forEach(function (a) {
      var b = h('<button type="button" class="btn ' + (a.cls || 'btn-primary') + '">' + esc(a.label) + '</button>');
      b.addEventListener('click', function () {
        if (a.close !== false) closeModal();
        if (a.onClick) a.onClick();
      });
      actions.appendChild(b);
    });
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim && opts.dismiss !== false) closeModal();
    });
    scrim.dataset.dismiss = opts.dismiss === false ? '0' : '1';
    modalRoot.appendChild(scrim);
    var first = actions.querySelector('button');
    if (first) first.focus();
    return scrim;
  }

  function closeModal() {
    var m = modalRoot.lastElementChild;
    if (m) m.remove();
  }

  function setChrome() {
    var inner = route !== 'home';
    btnBack.hidden = !inner;
    brand.hidden = inner;
    btnSettings.hidden = (route === 'play' || route === 'boom' || route === 'create' || route === 'team' || route === 'category');
  }

  function go(r) {
    stopTimer();
    route = r;
    setChrome();
    render();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- رندر ---------------- */

  function render() {
    var fn = {
      home: renderHome,
      create: renderCreate,
      team: renderTeam,
      category: renderCategory,
      play: renderPlay,
      boom: renderBoom,
      rank: renderRank,
      history: renderHistory,
      settings: renderSettings,
      about: renderAbout
    }[route] || renderHome;
    main.innerHTML = '';
    var node = fn();
    node.classList.add('screen');
    main.appendChild(node);
  }

  /* ----- خانه ----- */

  var HOW_STEPS = [
    { icon: 'users', title: 'بازی را بسازید', desc: 'تعداد گروه‌ها (۲ تا ۶)، تعداد دور و زمان اضافه را انتخاب کنید.' },
    { icon: 'spark', title: 'هر نوبت یک دسته', desc: 'تیم نوبت‌دار دسته را انتخاب می‌کند و امتیاز کلمه را مشخص می‌کند.' },
    { icon: 'book', title: 'یک کلمه، یک نتیجه', desc: 'کلمه مخفی است؛ با «شروع تایمر» اجرا می‌شود و در پایان امتیاز ثبت می‌کند.' }
  ];

  /* ---------------- ابزارهای نمایشی جدید ---------------- */

  /* گیج/تایمر حلقه‌ای */
  function gaugeMarkup(total, id) {
    var C = 2 * Math.PI * 52;
    return '<div class="gauge" id="' + id + '" data-c="' + C.toFixed(2) + '" data-total="' + total + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
      '<circle class="g-track" cx="60" cy="60" r="52"></circle>' +
      '<circle class="g-bar" cx="60" cy="60" r="52" style="stroke-dasharray:' + C.toFixed(2) + ';stroke-dashoffset:0"></circle>' +
      '</svg>' +
      '<div class="gauge-num" id="timer-num">0:00</div>' +
      '</div>';
  }

  function paintGauge(el, remaining, total, running) {
    if (!el) return;
    var C = parseFloat(el.dataset.c) || 326.7;
    var bar = el.querySelector('.g-bar');
    var ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    if (bar) bar.style.strokeDashoffset = (C * (1 - ratio)).toFixed(2);
    el.classList.toggle('is-urgent', !!running && remaining <= 10 && remaining > 0);
  }

  function sectionHead(icon, title, sub) {
    return h(
      '<div class="section-head">' +
      '<span class="sh-bar" aria-hidden="true"></span>' +
      '<span class="sh-txt">' +
      '<h2>' + esc(title) + '</h2>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') +
      '</span></div>'
    );
  }

  function initialOf(name) {
    var parts = String(name || '').trim().split(/\s+/);
    if (parts.length > 1) return parts[0].charAt(0) + parts[1].charAt(0);
    return String(name || '؟').replace(/[^؀-ۿ]/g, '').charAt(0) || '؟';
  }

  function teamRow(t, isNext, extra) {
    var color = TEAM_COLORS[t.color].v;
    return '<div class="team-row' + (isNext ? ' is-next' : '') + '" style="--team:' + color + '">' +
      '<span class="avatar">' + esc(initialOf(t.name)) + '</span>' +
      '<span class="tr-name">' + esc(t.name) +
      (isNext ? ' <span class="tr-badge">' + Icons.get('flag') + ' نوبت</span>' : '') +
      '</span>' +
      (extra || '') +
      '<span class="tr-score">' + fa(t.score) + '</span>' +
      '</div>';
  }

  /* ---------------- صفحه اصلی ---------------- */

  function renderHome() {
    var s = Store.stats;
    var el = h('<div></div>');

    el.appendChild(h(
      '<section class="hero">' +
      '<span class="eyebrow">بازی گروهی</span>' +
      '<h1>پانتومیم و <em>حدس کلمه</em></h1>' +
      '<p>هر نوبت یک کلمه: دسته را انتخاب کن، اجرا کن و امتیاز بگیر.</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn btn-primary btn-lg" id="cta-play">' + Icons.get('play') + ' شروع بازی</button>' +
      '<button type="button" class="btn btn-ghost btn-lg" id="cta-boom">' + Icons.get('bolt') + ' بازی بوم</button>' +
      '</div>' +
      '</section>'
    ));

    /* حالت‌های بازی */
    el.appendChild(sectionHead('grid', 'حالت‌های بازی'));
    var modes = h('<div class="bento"></div>');
    Object.keys(TYPES).forEach(function (key) {
      var m = TYPES[key];
      var accent = key === 'boom' ? '#4F46E5' : '#6D28D9';
      var card = h(
        '<button type="button" class="mode-card span-3" data-type="' + key + '" style="--glow-color:' + accent + '">' +
        '<span class="orb" style="--orb:' + accent + '">' + Icons.get(m.icon) + '</span>' +
        '<h3>' + m.title + '</h3>' +
        '<p>' + m.desc + '</p>' +
        '<span class="mc-meta">' + Icons.get('play') + ' شروع</span>' +
        '</button>'
      );
      card.addEventListener('click', function () { beep('click'); pendingType = key; go('create'); });
      modes.appendChild(card);
    });
    el.appendChild(modes);

    /* مراحل بازی */
    el.appendChild(sectionHead('spark', 'چطور بازی کنیم؟'));
    var steps = h('<div class="timeline"></div>');
    HOW_STEPS.forEach(function (st, i) {
      steps.appendChild(h(
        '<div class="tl-item">' +
        '<span class="tl-num">' + fa(i + 1) + '</span>' +
        '<div><h3>' + st.title + '</h3><p>' + st.desc + '</p></div>' +
        '</div>'
      ));
    });
    el.appendChild(steps);

    /* آمار کاربر */
    el.appendChild(sectionHead('chart', 'آمار شما'));
    var statGrid = h('<div class="stat-grid"></div>');
    statGrid.appendChild(h(
      '<button type="button" class="stat-card" data-stats>' +
      '<span class="orb orb-sm sc-orb" style="--orb:#6D28D9">' + Icons.get('chart') + '</span>' +
      '<b>' + fa(s.games) + '</b><span class="sc-lbl">بازی انجام‌شده</span></button>'
    ));
    statGrid.appendChild(h(
      '<button type="button" class="stat-card" data-stats>' +
      '<span class="orb orb-sm sc-orb" style="--orb:#0891B2">' + Icons.get('target') + '</span>' +
      '<b>' + fa(s.words) + '</b><span class="sc-lbl">کلمه‌ی بازی‌شده</span></button>'
    ));
    statGrid.appendChild(h(
      '<button type="button" class="stat-card" data-history>' +
      '<span class="orb orb-sm sc-orb" style="--orb:#4F46E5">' + Icons.get('history') + '</span>' +
      '<b>' + fa(Store.history.length) + '</b><span class="sc-lbl">بازی اخیر</span></button>'
    ));
    el.appendChild(statGrid);

    /* تنظیمات و درباره */
    el.appendChild(h(
      '<div class="list" style="margin-top:var(--s-3)">' +
      '<button type="button" class="list-row" id="open-settings">' +
      '<span class="orb orb-sm" style="--orb:#0891B2">' + Icons.get('settings') + '</span>' +
      '<span class="lr-txt"><strong>تنظیمات بازی</strong><span>صدا و لرزش</span></span>' +
      Icons.get('next') + '</button>' +
      '<button type="button" class="list-row" id="open-about">' +
      '<span class="orb orb-sm" style="--orb:#4F46E5">' + Icons.get('info') + '</span>' +
      '<span class="lr-txt"><strong>درباره و حریم خصوصی</strong><span>بدون جمع‌آوری داده</span></span>' +
      Icons.get('next') + '</button>' +
      '</div>'
    ));

    /* CTA پایانی */
    el.appendChild(h(
      '<section class="card card-lg card-accent" style="margin-top:var(--section-gap);text-align:center">' +
      '<h2 style="font-size:var(--fs-h2);font-weight:800;margin:0 0 var(--s-4)">آماده‌ای شروع کنی؟</h2>' +
      '<button type="button" class="btn btn-primary btn-lg btn-block" id="cta-final">' + Icons.get('play') + ' شروع بازی</button>' +
      '</section>'
    ));

    el.querySelector('#cta-play').addEventListener('click', function () { beep('click'); pendingType = 'adabazi'; go('create'); });
    el.querySelector('#cta-final').addEventListener('click', function () { beep('click'); pendingType = 'adabazi'; go('create'); });
    el.querySelector('#cta-boom').addEventListener('click', function () { beep('click'); pendingType = 'boom'; go('create'); });
    el.querySelector('#open-settings').addEventListener('click', function () { beep('click'); go('settings'); });
    el.querySelector('#open-about').addEventListener('click', function () { beep('click'); go('about'); });
    el.querySelectorAll('[data-stats], [data-history]').forEach(function (b) {
      b.addEventListener('click', function () { beep('click'); go('history'); });
    });

    return el;
  }

  /* ---------------- ساخت بازی ---------------- */

  function renderCreate() {
    var st = Store.settings;
    if (!draft || draft.gameType !== pendingType) {
      draft = {
        gameType: pendingType,
        groups: st.groups || 2,
        rounds: st.rounds || 3,
        moreTime: pendingType === 'boom' ? (st.boomMoreTime || 5) : (st.moreTime || 15)
      };
    }
    var d = draft;
    var t = TYPES[d.gameType];
    var el = h('<div></div>');

    el.appendChild(h(
      '<section class="card card-lg">' +
      '<span class="eyebrow">' + t.title + '</span>' +
      '<h1 style="font-size:var(--fs-h1);font-weight:900;margin:var(--s-2) 0 0;letter-spacing:-.02em">بازی جدید</h1>' +
      '</section>'
    ));

    /* چیدمان بازی */
    var fields = h('<div style="margin-top:var(--s-4)"></div>');
    fields.appendChild(stepper(d.gameType === 'boom' ? 'تعداد بازیکن' : 'تعداد گروه', d.groups, 2, 6, function (v) { d.groups = v; },
      d.gameType === 'boom' ? 'بازیکن‌ها بین خود بازی می‌کنند' : 'گروه‌ها به‌صورت نوبتی بازی می‌کنند'));
    fields.appendChild(stepper('تعداد دور', d.rounds, 1, 10, function (v) { d.rounds = v; }, 'هر دور یک نوبت برای هر گروه'));
    el.appendChild(fields);

    /* زمان */
    el.appendChild(h(
      '<div class="section-head"><span class="sh-bar" aria-hidden="true"></span>' +
      '<span class="sh-txt"><h2>' + (d.gameType === 'boom' ? 'زمان هر کلمه' : 'زمان اضافه هر نوبت') + '</h2>' +
      '<p>' + (d.gameType === 'boom' ? 'مهلت اجرای هر کلمه' : 'به زمان هر نوبت اضافه می‌شود') + '</p></span></div>'
    ));
    var seg = h('<div class="seg" id="more-row"></div>');
    var moreOpts = d.gameType === 'boom' ? [5, 6, 7] : [0, 15, 30, 45];
    moreOpts.forEach(function (v) {
      var chip = h('<button type="button" class="chip" data-v="' + v + '">' + fa(v) + ' ثانیه</button>');
      chip.addEventListener('click', function () {
        d.moreTime = v;
        paintMore();
        beep('click');
      });
      seg.appendChild(chip);
    });
    function paintMore() {
      seg.querySelectorAll('[data-v]').forEach(function (c) {
        c.classList.toggle('is-on', Number(c.dataset.v) === d.moreTime);
      });
    }
    paintMore();
    el.appendChild(seg);

    /* شروع */
    var dock = h('<div class="dock"></div>');
    var start = h('<button type="button" class="btn btn-primary btn-lg">' + Icons.get('play') + ' شروع بازی</button>');
    start.addEventListener('click', function () { beginGame(); });
    dock.appendChild(start);
    el.appendChild(dock);

    el.appendChild(h('<p class="foot">نام گروه‌ها خودکار ساخته می‌شود: ' + (d.gameType === 'boom' ? 'بازیکن' : 'گروه') + ' ' + fa(1) + ' تا ' + fa(d.groups) + '.</p>'));

    return el;
  }

  function stepper(label, val, min, max, onChange, sub) {
    var wrap = h(
      '<div class="field">' +
      '<div class="f-txt"><strong>' + esc(label) + '</strong>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' +
      '<div class="stepper">' +
      '<button type="button" class="step-btn" data-dec aria-label="کاهش">' + Icons.get('minus') + '</button>' +
      '<span class="step-val" data-val>' + fa(val) + '</span>' +
      '<button type="button" class="step-btn" data-inc aria-label="افزایش">' + Icons.get('plus') + '</button>' +
      '</div></div>'
    );
    var v = val;
    function paint() { wrap.querySelector('[data-val]').textContent = fa(v); }
    wrap.querySelector('[data-dec]').addEventListener('click', function () {
      if (v > min) { v--; paint(); onChange(v); beep('click'); vibrate(10); }
    });
    wrap.querySelector('[data-inc]').addEventListener('click', function () {
      if (v < max) { v++; paint(); onChange(v); beep('click'); vibrate(10); }
    });
    return wrap;
  }

  /* ---------------- شروع بازی ---------------- */

  function beginGame() {
    var d = draft;
    Store.setSetting('rounds', d.rounds);
    Store.setSetting('groups', d.groups);
    if (d.gameType === 'boom') Store.setSetting('boomMoreTime', d.moreTime);
    else Store.setSetting('moreTime', d.moreTime);

    var teams = [];
    for (var i = 0; i < d.groups; i++) {
      teams.push({
        name: (d.gameType === 'boom' ? 'بازیکن ' : 'گروه ') + fa(i + 1),
        color: i % TEAM_COLORS.length
      });
    }

    engine = new GameEngine(data, {
      gameType: d.gameType,
      teams: teams,
      rounds: d.rounds,
      moreTime: d.moreTime
    });

    beep('start');
    go('team');
  }

  /* ---------------- صفحه گروه ---------------- */

  function renderTeam() {
    if (engine.isOver()) { return renderRank(); }

    var el = h('<div></div>');
    var upNext = engine.team(engine.turnIndex);
    var upColor = TEAM_COLORS[upNext.color].v;

    el.appendChild(h(
      '<div class="pill-row" style="margin-bottom:var(--s-4)">' +
      '<span class="pill pill-accent">' + Icons.get('flag') + ' دور ' + fa(engine.roundNumber()) + ' از ' + fa(engine.rounds) + '</span>' +
      '<span class="pill">' + Icons.get('grid') + ' ' + TYPES[engine.gameType].title + '</span>' +
      '</div>'
    ));

    el.appendChild(h(
      '<section class="card card-lg card-accent" style="text-align:center;border-color:' + upColor + '40;background:linear-gradient(180deg,' + upColor + '12,#fff)">' +
      '<span class="eyebrow" style="justify-content:center">نوبت بعدی</span>' +
      '<h2 style="font-size:var(--fs-display);font-weight:900;margin:var(--s-2) 0 0;color:' + upColor + '">' + esc(upNext.name) + '</h2>' +
      '<p style="margin:var(--s-2) 0 0;color:var(--text-dim);font-size:var(--fs-sm)">امتیاز ' + fa(upNext.score) + '</p>' +
      '</section>'
    ));

    el.appendChild(h('<div class="section-head"><span class="sh-bar" aria-hidden="true"></span><span class="sh-txt"><h2>جدول امتیازات</h2></span></div>'));
    var list = h('<div class="list"></div>');
    engine.teams.forEach(function (t, i) {
      list.appendChild(h(teamRow(t, i === engine.turnIndex)));
    });
    el.appendChild(list);

    var dock = h('<div class="dock"></div>');
    var cta = h('<button type="button" class="btn btn-primary btn-lg">' + Icons.get('play') + ' شروع نوبت «' + esc(upNext.name) + '»</button>');
    cta.addEventListener('click', function () {
      beep('start');
      vibrate(20);
      engine.continueTurn();
      if (engine.gameType === 'boom') {
        engine.startBoom();
        go('boom');
      } else {
        go('category');
      }
    });
    dock.appendChild(cta);
    el.appendChild(dock);

    render._cleanup = function () { stopTimer(); };
    return el;
  }

  /* ---------------- انتخاب دسته ---------------- */

  function categoryGroups() {
    var groups = [];
    var cur = null;
    data.categories.forEach(function (c) {
      if (c.design === 0) {
        cur = { name: c.fa, color: c.color, items: [] };
        groups.push(cur);
      } else if (cur) {
        cur.items.push(c);
      }
    });
    var team = engine.team(engine.turnIndex);
    var rand = null;
    groups.forEach(function (g) {
      /* «تصادفی» از گروه جدا می‌شود تا در ردیف مستقل بیاید */
      g.items = g.items.filter(function (i) {
        if (i.cid === 69) { rand = i; return false; }
        return true;
      });
      if (g.name === 'ضرب المثل' && (team.proverbState || engine.isCardUsed(engine.turnIndex, 50, 20))) {
        g.items = g.items.filter(function (i) { return i.score !== 20; });
      }
    });
    if (rand) {
      var rg = { name: 'تصادفی', color: rand.color, items: [rand], random: true };
      /* بالای همه‌ی دسته‌بندی‌های کلمه */
      var idx = groups.findIndex(function (g) { return g.name === 'کلمه'; });
      groups.splice(idx >= 0 ? idx : groups.length, 0, rg);
    }
    return groups;
  }

  var CAT_ICON = {
    40: 'bolt', 50: 'quote', 60: 'mic', 69: 'dice', 70: 'general',
    71: 'food', 72: 'object', 73: 'film', 74: 'celebrity', 75: 'place',
    76: 'sport', 77: 'job', 78: 'animal', 79: 'book', 80: 'tech',
    81: 'globe', 82: 'music', 83: 'kids', 84: 'cartoon', 85: 'celebrity', 86: 'football'
  };

  function renderCategory() {
    var el = h('<div></div>');
    var team = engine.team(engine.turnIndex);

    el.appendChild(h(
      '<div class="pill-row" style="margin-bottom:var(--s-4)">' +
      '<span class="pill pill-accent">' +
      Icons.get('users') + ' نوبت ' + esc(team.name) + '</span>' +
      '<span class="pill">' + Icons.get('flag') + ' دور ' + fa(engine.roundNumber()) + ' از ' + fa(engine.rounds) + '</span>' +
      '</div>'
    ));

    el.appendChild(h('<p class="lead" style="color:var(--text-dim);margin:0 0 var(--s-4)">دسته‌ی این نوبت را انتخاب کن</p>'));

    var wrap = h('<div></div>');
    categoryGroups().forEach(function (g) {
      /* ردیف مستقل «تصادفی» — بدون نشانگر وضعیت */
      if (g.random) {
        var rc = g.items[0];
        var ric = CAT_ICON[rc.cid] || 'dice';
        var rTile = h(
          '<button type="button" class="cat-tile wide" style="--cat:' + rc.color + '">' +
          '<span class="cat-ic">' + Icons.get(ric) + '</span>' +
          '<span class="cat-name">' + esc(rc.fa) + '</span>' +
          '</button>'
        );
        rTile.addEventListener('click', function () { openCatDialog(rc); });
        var rSec = h('<div class="cat-section"><div class="cat-grid"></div></div>');
        rSec.querySelector('.cat-grid').appendChild(rTile);
        wrap.appendChild(rSec);
        return;
      }
      var sec = h(
        '<div class="cat-section">' +
        '<div class="section-head" style="margin-top:0">' +
        '<span class="sh-bar" style="background:' + g.color + '"></span>' +
        '<span class="sh-txt"><h2>' + esc(g.name) + '</h2></span>' +
        '</div>' +
        '<div class="cat-grid"></div>' +
        '</div>'
      );
      var grid = sec.querySelector('.cat-grid');
      g.items.forEach(function (c) {
        var ic = CAT_ICON[c.cid] || 'grid';
        var opts = engine.cardOptions(c);
        var used = opts.map(function (sc) { return engine.isCardUsed(engine.turnIndex, c.cid, sc); });
        var allUsed = used.length > 0 && used.every(Boolean);
        var dots = used.map(function (u) { return '<i class="dot' + (u ? ' is-used' : '') + '"></i>'; }).join('');
        var tile = h(
          '<button type="button" class="cat-tile' + (allUsed ? ' is-done' : '') + '" style="--cat:' + c.color + '"' +
          (allUsed ? ' aria-disabled="true"' : '') + '>' +
          '<span class="cat-ic">' + Icons.get(ic) + '</span>' +
          '<span class="cat-name">' + esc(c.fa) + '</span>' +
          '<span class="cat-dots" aria-label="وضعیت امتیازهای این دسته">' + dots + '</span>' +
          '</button>'
        );
        tile.addEventListener('click', function () {
          if (allUsed) { toast('همه‌ی امتیازهای «' + c.fa + '» برای این تیم استفاده شده'); return; }
          openCatDialog(c);
        });
        grid.appendChild(tile);
      });
      wrap.appendChild(sec);
    });
    el.appendChild(wrap);

    render._cleanup = function () { stopTimer(); };
    return el;
  }

  function openCatDialog(c) {
    beep('click');
    var ic = CAT_ICON[c.cid] || 'grid';

    var title = esc(c.fa);
    if (c.cid === 40) title = 'سرعتی ' + esc(c.fa);
    if (c.cid === 50) title = 'ضرب‌المثل ' + esc(c.fa);
    if (c.cid === 60) title = 'ترانه ' + esc(c.fa);

    var body =
      '<div class="sheet-pick" style="--orb:' + c.color + '">' +
      '<span class="sp-name">' + title + '</span>' +
      '</div>' +
      '<p style="text-align:center;color:var(--text-faint);font-size:var(--fs-sm);margin:0 0 var(--s-4)">انتخاب امتیاز</p>' +
      '<div class="chip-row" id="sc-row" style="justify-content:center"></div>';

    var scrim = modal({
      title: 'دسته انتخاب شد',
      icon: ic,
      iconColor: c.color,
      body: body,
      dismiss: false,
      actions: [
        { label: 'انصراف', cls: 'btn-ghost', onClick: function () { catSel = null; } },
        { label: 'ادامه', cls: 'btn-primary', id: 'sc-continue', onClick: function () { launchTurn(); } }
      ]
    });

    catSel = { cid: c.cid, score: c.score };

    var row = scrim.querySelector('#sc-row');
    var contBtn = null;
    scrim.querySelectorAll('.sheet-actions .btn').forEach(function (b) {
      if (b.textContent.indexOf('ادامه') >= 0) contBtn = b;
    });

    var opts = engine.cardOptions(c);
    var firstFree = -1;
    opts.forEach(function (sc) { if (firstFree < 0 && !engine.isCardUsed(engine.turnIndex, c.cid, sc)) firstFree = sc; });

    if (c.score === 0) {
      catSel.score = firstFree >= 0 ? firstFree : opts[0];
      opts.forEach(function (sc) {
        var used = engine.isCardUsed(engine.turnIndex, c.cid, sc);
        var chip = h('<button type="button" class="chip' + (used ? ' is-used' : '') + '" data-sc="' + sc + '"' + (used ? ' disabled aria-disabled="true"' : '') + '>' +
          fa(sc) + ' امتیازی' + (used ? ' ✓' : '') + '</button>');
        chip.addEventListener('click', function () {
          if (used) { toast('این امتیاز از «' + c.fa + '» برای این تیم استفاده شده'); return; }
          catSel.score = sc;
          paintSc();
          beep('click');
        });
        row.appendChild(chip);
      });
      function paintSc() {
        row.querySelectorAll('[data-sc]').forEach(function (ch) {
          ch.classList.toggle('is-on', !ch.disabled && Number(ch.dataset.sc) === catSel.score);
        });
      }
      paintSc();
      if (firstFree < 0) {
        contBtn.disabled = true;
      }
    } else {
      var usedFixed = engine.isCardUsed(engine.turnIndex, c.cid, c.score);
      row.appendChild(h('<span class="pill' + (usedFixed ? '' : ' pill-accent') + '">' + fa(c.score) + ' امتیازی' + (usedFixed ? ' ✓ استفاده‌شده' : '') + '</span>'));
      if (usedFixed) { if (contBtn) contBtn.disabled = true; }
      else if (contBtn) contBtn.classList.add('btn-lg');
    }
  }

  function launchTurn() {
    var t = engine.startTurn(catSel.cid, catSel.score);
    catSel = null;
    if (!t) { toast('محتوایی برای این دسته پیدا نشد'); go('team'); return; }
    beep('start');
    go('play');
  }

  /* ---------------- نوبت ادابازی ---------------- */

  function turnCategoryName(t) {
    if (t.cid === 40) return 'سرعتی ' + (t.score === 99 ? 'نامحدود' : fa(t.score) + ' امتیازی');
    if (t.cid === 50) return 'ضرب‌المثل ' + fa(t.score) + ' امتیازی';
    if (t.cid === 60) return 'ترانه ' + fa(t.score) + ' امتیازی';
    if (t.cid === 69) return 'کلمه تصادفی ' + (t.score ? fa(t.score) + ' امتیازی' : '');
    var cat = data.categories.filter(function (c) { return c.cid === t.cid && c.design !== 0; })[0];
    return cat ? cat.fa + ' ' + fa(t.score) + ' امتیازی' : '';
  }

  function renderPlay() {
    var t = engine.turn;
    var isSpeed = t.cid === 40;
    var el = h('<div></div>');
    var team = engine.team(engine.turnIndex);

    el.appendChild(h(
      '<div class="pill-row" style="margin-bottom:var(--s-3)">' +
      '<span class="pill pill-accent">' +
      Icons.get('users') + ' ' + esc(team.name) + '</span>' +
      '<span class="pill">' + Icons.get('layers') + ' ' + esc(turnCategoryName(t)) + '</span>' +
      '</div>'
    ));

    el.appendChild(h(gaugeMarkup(t.stableTime, 'gauge')));

    var wordCard = h(
      '<div class="spotlight" id="word-card">' +
      '<div class="w-meta" id="w-meta"></div>' +
      '<div class="w-text" id="w-text">کلمه مخفی است</div>' +
      '<div class="w-sub" id="w-sub"></div>' +
      '</div>'
    );

    var bigBtn = h('<button type="button" class="btn btn-primary btn-lg btn-block" id="big-btn" style="margin-top:var(--s-4);min-height:64px"></button>');

    var controls = h('<div class="controls" id="controls"></div>');

    el.appendChild(wordCard);
    el.appendChild(bigBtn);
    el.appendChild(controls);

    function paintWord() {
      var meta = wordCard.querySelector('#w-meta');
      var txt = wordCard.querySelector('#w-text');
      var sub = wordCard.querySelector('#w-sub');
      meta.innerHTML = '';
      wordCard.classList.toggle('is-hidden', t.state === 1);
      if (t.state === 1) {
        txt.textContent = 'کلمه مخفی است';
        txt.classList.remove('len-m', 'len-l', 'len-xl');
        sub.textContent = '';
        return;
      }
      if (isSpeed) {
        meta.appendChild(h('<span class="score-badge">' + fa(t.word.score) + ' امتیاز</span>'));
        var cat = data.categories.filter(function (c) { return c.cid === t.word.cid; })[0];
        if (cat) meta.appendChild(h('<span class="tag">' + esc(cat.fa) + '</span>'));
        meta.appendChild(h('<span class="tag">' + (t.score === 99 ? fa(t.speedIndex) : fa(t.speedIndex) + ' از ' + fa(t.speedList.length)) + '</span>'));
      } else {
        meta.appendChild(h('<span class="score-badge">' + fa(t.wordScore) + ' امتیاز</span>'));
        if (t.cid === 69) {
          var c69 = data.categories.filter(function (c) { return c.cid === t.word.cid; })[0];
          if (c69) meta.appendChild(h('<span class="tag">' + esc(c69.fa) + '</span>'));
        }
        if (t.cid === 50) meta.appendChild(h('<span class="tag">ضرب‌المثل</span>'));
      }
      var w = t.word;
      txt.textContent = w.text;
      var len = w.text.length;
      txt.classList.toggle('len-m', len > 14 && len <= 30);
      txt.classList.toggle('len-l', len > 30 && len <= 70);
      txt.classList.toggle('len-xl', len > 70);
      sub.textContent = w.sub || '';
    }

    function paintBig() {
      var label, icon, cls;
      if (t.state === 1) { label = 'نمایش کلمه'; icon = 'eye'; cls = 'btn-primary'; }
      else if (t.state === 2) { label = 'شروع تایمر'; icon = 'play2'; cls = 'btn-success'; }
      else if (isSpeed) { label = 'تایمر در حال اجرا'; icon = 'pause'; cls = 'btn-ghost'; }
      else { label = 'پایان نوبت'; icon = 'flag'; cls = 'btn-success'; }
      bigBtn.className = 'btn ' + cls + ' btn-lg btn-block';
      bigBtn.innerHTML = Icons.get(icon) + '<span>' + label + '</span>';
      bigBtn.disabled = (isSpeed && t.state === 3);
    }

    function paintControls() {
      controls.innerHTML = '';
      if (t.state === 1) return;
      if (isSpeed) {
        addBtn('btn-success', 'check', 'درست', function () {
          var r = engine.speedTrue();
          if (r === 'dialog') { stopTimer(); openSpeedDialog(); return; }
          beep('correct'); vibrate(14); repaint();
        }, 'c-speed-ok');
        addBtn('btn-ghost', 'skip', 'رد شدن', function () {
          var r = engine.speedChange();
          if (r === 'dialog') { stopTimer(); openSpeedDialog(); return; }
          beep('skip'); vibrate(10); repaint();
        }, 'c-speed-change');
        addBtn('btn-danger', 'x', 'خطا (' + fa(Math.min(3, -t.wrongCounter)) + ')', function () {
          var r = engine.speedFault();
          if (r === 'faultout') { stopTimer(); beep('wrong'); vibrate(300); openResultDialog(true); return; }
          beep('wrong'); vibrate([18, 40, 18]); repaint();
        }, 'c-speed-fault');
      } else {
        if (!(t.cid === 50 && t.score === 20)) {
          addBtn('btn-ghost', 'swap', 'تعویض کلمه' + (t.changeState ? ' (' + fa(t.changeState) + ')' : ''), function () {
            if (engine.change()) { beep('click'); vibrate(10); repaint(); }
          });
        }
        if (t.cid === 50) {
          addBtn('btn-ghost', 'timer', 'زمان اضافه +۳۰ث' + (t.extraTimeState ? ' (' + fa(t.extraTimeState) + ')' : ''), function () {
            if (engine.extraTime()) { beep('click'); paintTimer(); repaint(); }
          });
        }
        addBtn('btn-danger', 'x', 'خطا' + (t.wrongCounter ? ' (' + fa(t.wrongCounter) + ')' : ''), function () {
          var r = engine.fault();
          if (r === 'faultout') { stopTimer(); beep('wrong'); vibrate(300); openResultDialog(true); return; }
          beep('wrong'); vibrate([18, 40, 18]); paintTimer(); repaint();
        });
      }
    }

    function addBtn(cls, icon, label, fn, id) {
      var b = h('<button type="button" class="btn ' + cls + '"' + (id ? ' id="' + id + '"' : '') + '>' + Icons.get(icon) + '<span>' + label + '</span></button>');
      b.addEventListener('click', fn);
      controls.appendChild(b);
    }

    function paintTimer() {
      var num = el.querySelector('#timer-num');
      var g = el.querySelector('#gauge');
      var left = (t.state === 1) ? t.stableTime : t.timeLeft;
      num.textContent = mmss(left);
      paintGauge(g, left, t.stableTime, t.running);
    }

    function repaint() {
      paintWord();
      paintBig();
      paintControls();
      paintTimer();
    }

    bigBtn.addEventListener('click', function () {
      if (t.state === 1) {
        engine.reveal();
        beep('click');
        vibrate(12);
        repaint();
      } else if (t.state === 2) {
        engine.run();
        startTick();
        beep('start');
        vibrate(20);
        repaint();
      } else if (t.state === 3 && !isSpeed) {
        engine.stop();
        stopTimer();
        beep('end');
        vibrate([30, 60, 30]);
        repaint();
        openResultDialog(false);
      }
    });

    render._cleanup = function () { stopTimer(); };

    repaint();
    if (t.running) startTick();
    return el;

    function startTick() {
      stopTimer();
      timerId = setInterval(function () {
        var r = engine.tick();
        paintTimer();
        if (r === 'timeout') {
          stopTimer();
          beep('end');
          vibrate([30, 60, 30]);
          repaint();
          if (isSpeed) openSpeedDialog();
          else openResultDialog(false);
          return;
        }
        if (r <= 10 && r > 0) beep('tick');
      }, 1000);
    }

    /* دیالوگ نتیجه نوبت عادی */
    function openResultDialog(faultOut) {
      var scrim = modal({
        title: 'نتیجه اجرا',
        icon: 'flag',
        iconColor: '#6D28D9',
        dismiss: false,
        body: '<div id="res-rows"></div>',
        actions: []
      });
      var actions = scrim.querySelector('.sheet-actions');

      function rowsHTML() {
        function row(label, v, color) {
          return '<div class="score-row" style="--dot:' + (color || (v >= 0 ? 'var(--success)' : 'var(--danger)')) + '">' +
            '<span class="sr-dot"></span>' +
            '<span class="sr-name">' + label + '</span>' +
            '<span class="sr-val">' + (v >= 0 ? '+' : '') + fa(v) + '</span>' +
            '</div>';
        }
        return row('امتیاز کلمه', t.wordScore, 'var(--primary)') +
          row('تعویض کلمه', t.changeState) +
          row('زمان اضافه', t.extraTimeState) +
          row('خطا', t.wrongCounter) +
          '<div class="score-total"><b>جمع کل</b><span>' + fa(engine.total()) + '</span></div>';
      }

      function paintRows() {
        scrim.querySelector('#res-rows').innerHTML = rowsHTML();
      }
      paintRows();

      if (!faultOut) {
        var ok = h('<button type="button" class="btn btn-success">' + Icons.get('check') + '<span>درست</span></button>');
        ok.addEventListener('click', function () {
          engine.dialogRight();
          beep('correct');
          vibrate(20);
          paintRows();
          ok.disabled = true;
          no.disabled = true;
          toast('پاداش زمان اضافه شد: ' + fa(Math.floor(t.timeLeft / 30)));
        });
        var no = h('<button type="button" class="btn btn-danger">' + Icons.get('x') + '<span>غلط</span></button>');
        no.addEventListener('click', function () {
          engine.dialogWrong();
          beep('wrong');
          vibrate(30);
          paintRows();
          ok.disabled = true;
          no.disabled = true;
        });
        actions.appendChild(ok);
        actions.appendChild(no);
      }

      var cont = h('<button type="button" class="btn btn-primary btn-block" style="margin-top:var(--s-2)">' + Icons.get('play') + '<span>ادامه</span></button>');
      cont.addEventListener('click', function () {
        var total = engine.total();
        var s = engine.commitTurn(total);
        closeModal();
        if (s.type === 'end') { go('rank'); }
        else { go('team'); toast('امتیاز ثبت شد: ' + (total >= 0 ? '+' : '') + fa(total)); }
      });
      actions.appendChild(cont);
    }

    /* دیالوگ نتیجه سرعتی */
    function openSpeedDialog() {
      var sum = engine.speedTotal();
      var body = '<div style="max-height:38vh;overflow:auto">';
      t.speedList.forEach(function (x) {
        body += '<div class="score-row" style="--dot:' + (x.right ? 'var(--success)' : 'var(--danger)') + '">' +
          '<span class="sr-dot"></span>' +
          '<span class="sr-name">' + esc(x.word.text) + '</span>' +
          '<span class="sr-val">' + (x.right ? '+' + fa(x.word.score) : '—') + '</span>' +
          '</div>';
      });
      body += '</div><div class="score-total"><b>جمع کل</b><span>' + fa(sum) + '</span></div>';

      modal({
        title: 'نتیجه سرعتی',
        icon: 'bolt',
        iconColor: '#6D28D9',
        body: body,
        dismiss: false,
        actions: [{
          label: 'ادامه', cls: 'btn-primary', onClick: function () {
            var s = engine.commitTurn(sum);
            if (s.type === 'end') go('rank');
            else { go('team'); toast('امتیاز ثبت شد: ' + (sum >= 0 ? '+' : '') + fa(sum)); }
          }
        }]
      });
    }
  }

  /* ---------------- بوم ---------------- */

  function renderBoom() {
    var b = engine.boom;
    var el = h('<div></div>');

    el.appendChild(h(
      '<div class="pill-row" style="margin-bottom:var(--s-3)">' +
      '<span class="pill pill-accent" id="boom-player">' +
      Icons.get('users') + ' ' + esc(engine.team(b.active).name) + '</span>' +
      '<span class="pill">' + Icons.get('flag') + ' دور <span id="boom-round">' + fa(engine.roundNumber()) + '</span> از ' + fa(engine.rounds) + '</span>' +
      '</div>'
    ));

    el.appendChild(h(gaugeMarkup(engine.moreTime, 'gauge')));

    var wordCard = h(
      '<div class="spotlight" id="word-card">' +
      '<div class="w-head">سه</div>' +
      '<div class="w-text" id="w-text">' + esc(b.word || '') + '</div>' +
      '</div>'
    );

    var bigBtn = h('<button type="button" class="btn btn-primary btn-lg btn-block" id="big-btn" style="margin-top:var(--s-4);min-height:64px"></button>');
    var controls = h('<div class="controls" id="controls"></div>');

    el.appendChild(wordCard);
    el.appendChild(bigBtn);
    el.appendChild(controls);

    function paint() {
      var holder = engine.team(b.state === 1 ? b.player : b.active);
      var pill = el.querySelector('#boom-player');
      pill.innerHTML = Icons.get('users') + ' ' + esc(holder.name);

      var txt = el.querySelector('#w-text');
      if (b.word) {
        txt.textContent = b.word;
        var len = b.word.length;
        txt.classList.toggle('len-m', len > 14 && len <= 30);
        txt.classList.toggle('len-l', len > 30 && len <= 70);
        txt.classList.toggle('len-xl', len > 70);
      } else {
        txt.textContent = '—';
      }

      var num = el.querySelector('#timer-num');
      num.textContent = mmss(b.state === 1 ? engine.moreTime : b.timeLeft);
      paintGauge(el.querySelector('#gauge'), b.state === 1 ? engine.moreTime : b.timeLeft, engine.moreTime, b.running);

      var round = el.querySelector('#boom-round');
      if (round) round.textContent = fa(engine.roundNumber());

      bigBtn.className = 'btn btn-lg btn-block';
      if (b.state === 1) {
        bigBtn.innerHTML = Icons.get('eye') + '<span>شروع نوبت</span>';
        bigBtn.classList.add('btn-primary');
        bigBtn.disabled = false;
      } else if (b.state === 2) {
        bigBtn.innerHTML = Icons.get('play2') + '<span>شروع ' + fa(engine.moreTime) + ' ثانیه‌ای</span>';
        bigBtn.classList.add('btn-success');
        bigBtn.disabled = false;
      } else {
        bigBtn.innerHTML = Icons.get('check') + '<span>درست</span>';
        bigBtn.classList.add(b.timeout ? 'btn-ghost' : 'btn-success');
        bigBtn.disabled = false;
      }

      controls.innerHTML = '';
      if (b.state === 3 && b.timeout) {
        var no = h('<button type="button" class="btn btn-danger">' + Icons.get('x') + '<span>غلط</span></button>');
        no.addEventListener('click', function () {
          stopTimer();
          engine.boomFalse();
          beep('wrong');
          vibrate(30);
          afterBoom();
        });
        controls.appendChild(no);
      }
    }

    function afterBoom() {
      var next = engine.boomNext();
      if (next === 'end') { paint(); go('rank'); return; }
      paint();
      beep('click');
      toast('نوبت ' + engine.team(b.player).name);
    }

    bigBtn.addEventListener('click', function () {
      if (b.state === 1) {
        engine.boomClaim();
        beep('click');
        vibrate(12);
        paint();
      } else if (b.state === 2) {
        engine.boomRun();
        startTick();
        beep('start');
        vibrate(20);
        paint();
      } else if (b.state === 3) {
        stopTimer();
        var gain = engine.boomTrue();
        beep('correct');
        vibrate(20);
        toast('+' + fa(gain) + ' امتیاز');
        afterBoom();
      }
    });

    function startTick() {
      stopTimer();
      timerId = setInterval(function () {
        var r = engine.boomTick();
        paint();
        if (r === 'timeout') {
          stopTimer();
          beep('end');
          vibrate([30, 60, 30]);
          toast('زمان تمام شد');
          paint();
        }
      }, 1000);
    }

    render._cleanup = function () { stopTimer(); };
    paint();
    return el;
  }

  /* ---------------- رتبه‌بندی ---------------- */

  function renderRank() {
    stopTimer();
    var rank = engine.rank();
    var winner = rank[0].score === rank[1].score ? null : rank[0];
    var isTie = !winner;

    if (!engine._recorded) {
      engine._recorded = true;
      Store.addGame({
        mode: engine.gameType,
        winner: isTie ? 'مساوی' : winner.name,
        score: rank[0].score,
        words: engine.wordsPlayed,
        rounds: engine.rounds,
        teams: engine.teams.length
      });
    }

    var el = h('<div></div>');

    var head = h(
      '<section class="card card-lg card-accent" style="text-align:center">' +
      '<span class="sheet-icon" style="--orb:' + (isTie ? '#7DD3FC' : '#6D28D9') + '">' + Icons.get(isTie ? 'heart' : 'crown') + '</span>' +
      '<h1 style="font-size:var(--fs-h1);font-weight:900;margin:0 0 4px">' + (isTie ? 'مساوی شد!' : 'برنده') + '</h1>' +
      '<p style="margin:0;color:var(--text-dim)">' + (isTie ? 'گروه‌ها مساوی‌اند' : esc(winner.name)) + '</p>' +
      '</section>'
    );
    el.appendChild(head);

    /* تاپ‌لیک سه نفره */
    if (rank.length >= 3) {
      var order = [rank[1], rank[0], rank[2]];
      var classes = ['pod-2', 'pod-1', 'pod-3'];
      var podium = h('<div class="podium"></div>');
      order.forEach(function (t, i) {
        podium.appendChild(h(
          '<div class="pod ' + classes[i] + '" style="--team:' + TEAM_COLORS[t.color].v + '">' +
          '<span class="p-rank">' + fa(i === 1 ? 1 : (i === 0 ? 2 : 3)) + '</span>' +
          '<span class="p-avatar">' + esc(initialOf(t.name)) + '</span>' +
          '<span class="p-name">' + esc(t.name) + '</span>' +
          '<span class="p-score">' + fa(t.score) + '</span>' +
          '</div>'
        ));
      });
      el.appendChild(podium);
    }

    /* فهرست کامل */
    var list = h('<div class="list"></div>');
    rank.forEach(function (t, i) {
      list.appendChild(h(teamRow(t, false, '<span class="pill" style="margin-inline-end:auto">' + fa(i + 1) + '</span>')));
    });
    el.appendChild(list);

    /* کنش‌ها */
    var actions = h('<div class="bento" style="margin-top:var(--s-4)"></div>');
    var shareBtn = h('<button type="button" class="mode-card span-3" style="--glow-color:#0891B2">' +
      '<span class="orb" style="--orb:#0891B2">' + Icons.get('share') + '</span>' +
      '<h3>اشتراک نتیجه</h3><p>متن نتیجه بازی</p></button>');
    shareBtn.addEventListener('click', function () { shareResult(); });
    var again = h('<button type="button" class="mode-card span-3" style="--glow-color:#6D28D9">' +
      '<span class="orb" style="--orb:#6D28D9">' + Icons.get('refresh') + '</span>' +
      '<h3>بازی دوباره</h3><p>با همین تنظیمات</p></button>');
    again.addEventListener('click', function () { beep('click'); beginGame(); });
    var home = h('<button type="button" class="mode-card span-3" style="--glow-color:#4F46E5">' +
      '<span class="orb" style="--orb:#4F46E5">' + Icons.get('home') + '</span>' +
      '<h3>صفحه اصلی</h3><p>انتخاب حالت بازی</p></button>');
    home.addEventListener('click', function () { beep('click'); engine = null; go('home'); });
    actions.appendChild(shareBtn);
    actions.appendChild(again);
    actions.appendChild(home);
    el.appendChild(actions);

    render._cleanup = function () { stopTimer(); };
    return el;
  }

  /* ---------------- تاریخچه ---------------- */

  function renderHistory() {
    var el = h('<div></div>');

    el.appendChild(h(
      '<section class="card card-lg" style="text-align:center">' +
      '<span class="eyebrow" style="justify-content:center">آرشیو</span>' +
      '<h1 style="font-size:var(--fs-h1);font-weight:900;margin:var(--s-2) 0 0">تاریخچه بازی‌ها</h1>' +
      '</section>'
    ));

    if (!Store.history.length) {
      el.appendChild(h(
        '<div class="empty card">' + Icons.get('history') +
        '<div>هنوز بازی‌ای انجام نشده</div></div>'
      ));
      return el;
    }

    var list = h('<div class="list" style="margin-top:var(--s-4)"></div>');
    Store.history.slice().reverse().forEach(function (g) {
      var isBoom = g.mode === 'boom';
      list.appendChild(h(
        '<div class="hist-item">' +
        '<span class="h-icon">' + Icons.get(isBoom ? 'bolt' : 'book') + '</span>' +
        '<span class="h-main"><strong>' + esc(g.winner || '—') + '</strong>' +
        '<span>' + (isBoom ? 'بوم' : 'ادابازی') + ' · ' + fa(g.rounds || 0) + ' دور</span></span>' +
        '<span class="h-score">' + fa(g.score || 0) + '</span>' +
        '</div>'
      ));
    });
    el.appendChild(list);

    var clear = h('<button type="button" class="btn btn-ghost btn-block" style="margin-top:var(--s-4)">' + Icons.get('trash') + ' پاک کردن تاریخچه</button>');
    clear.addEventListener('click', function () {
      modal({
        title: 'پاک کردن تاریخچه؟', icon: 'trash', iconColor: '#DC2626',
        body: 'همه‌ی بازی‌های ثبت‌شده حذف می‌شوند.',
        actions: [
          { label: 'انصراف', cls: 'btn-ghost' },
          {
            label: 'حذف کن', cls: 'btn-danger', onClick: function () {
              Store.clearHistory();
              toast('تاریخچه پاک شد');
              render();
            }
          }
        ]
      });
    });
    el.appendChild(clear);

    return el;
  }

  /* ---------------- تنظیمات ---------------- */

  function renderSettings() {
    var st = Store.settings;
    var el = h('<div></div>');

    el.appendChild(h(
      '<section class="card card-lg" style="text-align:center">' +
      '<span class="eyebrow" style="justify-content:center">تنظیمات</span>' +
      '<h1 style="font-size:var(--fs-h1);font-weight:900;margin:var(--s-2) 0 0">صدا و لرزش</h1>' +
      '</section>'
    ));

    var box = h('<div style="margin-top:var(--s-4)"></div>');
    box.appendChild(toggleRow('volume', 'صداهای بازی', 'بوق درست/غلط و پایان زمان', st.sound, function (v) {
      Store.setSetting('sound', v); GameAudio.setEnabled(v); if (v) beep('correct');
    }));
    box.appendChild(toggleRow('spark', 'لرزش گوشی', 'بازخورد لمسی هنگام پاسخ', st.haptics, function (v) {
      Store.setSetting('haptics', v); if (v) vibrate(30);
    }));
    el.appendChild(box);

    var about = h('<div style="margin-top:var(--s-4)"></div>');
    var resetBtn = h('<button type="button" class="btn btn-ghost btn-block">' + Icons.get('refresh') + ' بازنشانی کامل تنظیمات</button>');
    resetBtn.addEventListener('click', function () {
      modal({
        title: 'بازنشانی؟', icon: 'refresh', iconColor: '#DC2626',
        body: 'تنظیمات، آمار و تاریخچه به حالت اول برمی‌گردند.',
        actions: [
          { label: 'انصراف', cls: 'btn-ghost' },
          {
            label: 'بازنشانی', cls: 'btn-danger', onClick: function () {
              Store.reset(); toast('بازنشانی شد'); go('home');
            }
          }
        ]
      });
    });
    about.appendChild(resetBtn);

    var aboutBtn = h('<button type="button" class="btn btn-ghost btn-block" style="margin-top:var(--s-2)">' + Icons.get('info') + ' درباره ادابازی</button>');
    aboutBtn.addEventListener('click', function () { go('about'); });
    about.appendChild(aboutBtn);
    el.appendChild(about);

    return el;
  }

  function toggleRow(icon, title, sub, val, onChange) {
    var row = h(
      '<div class="setting-row">' +
      '<span class="orb orb-sm" style="--orb:#6D28D9">' + Icons.get(icon) + '</span>' +
      '<span class="sr-txt"><strong>' + esc(title) + '</strong><span>' + esc(sub) + '</span></span>' +
      '<button type="button" class="switch" role="switch" aria-checked="' + !!val + '" aria-label="' + esc(title) + '"></button>' +
      '</div>'
    );
    var sw = row.querySelector('.switch');
    sw.addEventListener('click', function () {
      var v = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', v ? 'true' : 'false');
      onChange(v);
    });
    return row;
  }

  /* ---------------- درباره ---------------- */

  function renderAbout() {
    var el = h('<div></div>');

    el.appendChild(h(
      '<section class="card card-lg" style="text-align:center">' +
      '<span class="eyebrow" style="justify-content:center">درباره</span>' +
      '<h1 style="font-size:var(--fs-h1);font-weight:900;margin:var(--s-2) 0 0">ادابازی</h1>' +
      '</section>'
    ));

    var list = h('<div class="list" style="margin-top:var(--s-4)"></div>');
    [
      ['heart', 'بدون جمع‌آوری داده', 'همه چیز روی همین دستگاه ذخیره می‌شود.', '#DC2626'],
      ['book', 'منطق اپ اصلی', 'ساخت نوبت‌ها، زمان هر دسته، تعویض کلمه، خطاها و پاداش زمان.', '#6D28D9'],
      ['grid', 'چهار دسته بازی', 'سرعتی، ضرب‌المثل، دسته‌های کلمه و ترانه + حالت ویژه‌ی بوم.', '#0891B2']
    ].forEach(function (r) {
      list.appendChild(h(
        '<div class="setting-row">' +
        '<span class="orb orb-sm" style="--orb:' + r[3] + '">' + Icons.get(r[0]) + '</span>' +
        '<span class="sr-txt"><strong>' + r[1] + '</strong><span>' + r[2] + '</span></span>' +
        '</div>'
      ));
    });
    el.appendChild(list);

    return el;
  }

  /* ---------------- کنترل‌های سراسری ---------------- */

  btnBack.addEventListener('click', function () {
    beep('click');
    if (route === 'play' || route === 'boom') {
      var wasRunning = (engine.turn && engine.turn.running) || (engine.boom && engine.boom.running);
      if (wasRunning) stopTimer();
      modal({
        title: 'خروج از بازی؟',
        body: 'بازی فعلی نیمه‌تمام می‌ماند.',
        icon: 'flag',
        dismiss: false,
        actions: [
          { label: 'ادامه بازی', cls: 'btn-ghost', onClick: function () { if (wasRunning) { /* تایمر متوقف می‌ماند تا شروع مجدد */ } render(); } },
          { label: 'خروج', cls: 'btn-danger', onClick: function () { stopTimer(); engine = null; go('home'); } }
        ]
      });
    } else if (route === 'team' || route === 'category' || route === 'rank') {
      if (route === 'rank') { engine = null; go('home'); return; }
      modal({
        title: 'خروج از بازی؟',
        body: 'بازی فعلی نیمه‌تمام می‌ماند.',
        icon: 'flag',
        dismiss: false,
        actions: [
          { label: 'ادامه بازی', cls: 'btn-ghost' },
          { label: 'خروج', cls: 'btn-danger', onClick: function () { engine = null; go('home'); } }
        ]
      });
    } else {
      go('home');
    }
  });

  btnSettings.addEventListener('click', function () { beep('click'); go('settings'); });

  document.addEventListener('keydown', function (e) {
    if (route !== 'play' || !engine || !engine.turn) return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (modalRoot.childElementCount) return;
    var t = engine.turn;
    var id = null;
    if (t.cid === 40 && t.state === 3) {
      if (e.key === 'ArrowRight' || e.key === '1') id = 'c-speed-ok';
      else if (e.key === 'ArrowLeft' || e.key === '2') id = 'c-speed-change';
    }
    if (id) {
      e.preventDefault();
      var b = document.getElementById(id);
      if (b) b.click();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var last = modalRoot.lastElementChild;
      if (last && last.dataset && last.dataset.dismiss !== '0') closeModal();
    }
  });

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  /* ---------------- راه‌اندازی ---------------- */

  function boot() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* بی‌صدا */ });
    }

    /* آیکون دکمه‌های نوار بالا */
    btnBack.innerHTML = Icons.get('back');
    btnSettings.innerHTML = Icons.get('settings');

    var loading = h('<div class="loading"><div class="spinner" role="status" aria-label="در حال بارگذاری"></div><div>در حال بارگذاری کلمات…</div></div>');
    main.appendChild(loading);

    GameAudio.setEnabled(Store.settings.sound);

    GameData.load().then(function (d) {
      data = d;
      main.innerHTML = '';
      go('home');
    }).catch(function (e) {
      main.innerHTML = '';
      main.appendChild(h(
        '<div class="empty card">' + Icons.get('info') +
        '<div>بارگذاری دیتا ناموفق بود.<br><span style="font-size:var(--fs-xs)">فایل data/words.json پیدا نشد. اپ را با یک سرور محلی باز کنید (مثلاً python -m http.server).</span></div></div>'
      ));
      console.error(e);
    });

    document.addEventListener('pointerdown', function once() {
      GameAudio.unlock();
      document.removeEventListener('pointerdown', once);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
