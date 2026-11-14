/* اپ اصلی — روتر و صفحات؛ جریان بازی مطابق اپ اصلی ادابازی:
 * ساخت بازی ← صفحه گروه ← انتخاب دسته (هر نوبت) ← بازی یک کلمه ← دیالوگ نتیجه ← صفحه گروه ... ← رتبه‌بندی
 */
(function () {
  'use strict';

  /* نسخه‌ی دارایی‌ها — با هر انتشار این عدد را زیاد کنید تا کش سرویس‌ورکر باطل شود */
  var APP_VERSION = '2.5.20';

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
  var celebrated = false;        // جشن پایان بازی فقط یک‌بار اجرا شود
  var turnsPlayed = 0;           // نوبت‌های انجام‌شده — برای نمایش درست شماره‌ی دور

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
    { v: '#6C21ED', n: 'بنفش' }, { v: '#E11D48', n: 'قرمز' }, { v: '#0891B2', n: 'آبی' },
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

  /* شماره‌ی دور برای نمایش: شمارنده‌ی موتور یک واحد جلوتر است،
     بنابراین دور واقعی از روی تعداد نوبت‌های انجام‌شده محاسبه می‌شود. */
  function currentRound() {
    if (!engine) return 1;
    var n = (engine.teams && engine.teams.length) || 1;
    var r = Math.floor(turnsPlayed / n) + 1;
    return Math.max(1, Math.min(r, engine.rounds));
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

  /* پیام‌ها روی هم انباشته نمی‌شوند — حداکثر دو پیام هم‌زمان */
  var toastQueue = [];
  function toast(msg) {
    var el = h('<div class="toast">' + esc(msg) + '</div>');
    toastRegion.appendChild(el);
    toastQueue.push(el);
    while (toastQueue.length > 2) {
      var old = toastQueue.shift();
      if (old && old.parentNode) old.remove();
    }
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(14px)';
      setTimeout(function () {
        el.remove();
        var i = toastQueue.indexOf(el);
        if (i > -1) toastQueue.splice(i, 1);
      }, 320);
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

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function fx(el, cls, ms) {
    if (!el || reducedMotion()) return;
    el.classList.remove(cls);
    /* ری‌فلو برای اجرای دوباره‌ی انیمیشن */
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { if (el) el.classList.remove(cls); }, ms || 700);
  }
  function pulseHUD() {
    var hudEl = document.querySelector('.hud');
    if (hudEl) fx(hudEl, 'is-updated', 800);
  }
  function countUp(el, to, duration, prefix) {
    if (!el) return;
    to = Math.round(Number(to) || 0);
    if (reducedMotion()) { el.textContent = (prefix || '') + fa(to); return; }
    duration = duration || 650;
    var start = 0, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / duration);
      var ease = 1 - Math.pow(1 - p, 3);
      var val = Math.round(start + (to - start) * ease);
      el.textContent = (prefix || '') + fa(val);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
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
    scrim._lastFocus = document.activeElement;
    modalRoot.appendChild(scrim);
    var first = actions.querySelector('button');
    if (first) first.focus();

    /* نگه‌داشتن فوکوس داخل شیت (دسترس‌پذیری) */
    scrim.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var items = scrim.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!items.length) return;
      var list = Array.prototype.slice.call(items);
      var idx = list.indexOf(document.activeElement);
      if (e.shiftKey && (idx <= 0)) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && (idx === list.length - 1 || idx === -1)) { e.preventDefault(); list[0].focus(); }
    });
    return scrim;
  }

  function closeModal(immediate) {
    var m = modalRoot.lastElementChild;
    if (!m) return;
    var restore = m._lastFocus;
    if (immediate === true || m.dataset.closing === '1') {
      if (immediate === true) { m.remove(); if (restore && restore.focus) restore.focus(); }
      return;
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { m.remove(); if (restore && restore.focus) restore.focus(); return; }
    m.dataset.closing = '1';
    m.classList.add('is-closing');
    var done = function () {
      if (m.parentNode) m.remove();
      if (restore && restore.focus) restore.focus();
    };
    m.addEventListener('animationend', done, { once: true });
    setTimeout(done, 260);
  }

  function setChrome() {
    var inner = route !== 'home';
    btnBack.hidden = !inner;
    brand.hidden = inner;
    btnSettings.hidden = (route === 'play' || route === 'boom' || route === 'create' || route === 'team' || route === 'category');
    main.setAttribute('data-route', route);
  }

  function go(r) {
    stopTimer();
    route = r;
    setChrome();
    render();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  /* ---------------- رندر ---------------- */

  function render() {
    /* پاک‌سازی صفحه‌ی قبلی (مثلاً توقف تایمر) پیش از ساخت صفحه‌ی جدید */
    if (render._cleanup) { render._cleanup(); render._cleanup = null; }
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
    { icon: 'book', title: 'یک کلمه، یک نتیجه', desc: 'کلمه مخفی است؛ با «شروع تایمر و اجرا» اجرا می‌شود و در پایان امتیاز ثبت می‌کند.' }
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
    var urgent = !!running && remaining <= 10 && remaining > 0;
    el.classList.toggle('is-urgent', urgent);
    var card = el.closest ? el.closest('.spotlight') : null;
    if (card) card.classList.toggle('is-urgent', urgent);
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
    var el = h('<div class="home"></div>');

    el.appendChild(h(
      '<section class="hero hero-home">' +
      '<div class="hero-decor" aria-hidden="true">' +
      '<span class="hero-bubble b1"></span><span class="hero-bubble b2"></span><span class="hero-bubble b3"></span>' +
      '</div>' +
      '<figure class="hero-mascot" aria-hidden="true">' + A3D.img('portalRing', 'a3d-hero') + '</figure>' +
      '<div class="hero-top">' +
      '<span class="eyebrow">بازی گروهی و دورهمی</span>' +
      '<span class="hero-badge">' + Icons.get('spark') + ' نسخه جدید</span>' +
      '</div>' +
      '<h1>پانتومیم کن، <em>حدس بزن</em>، امتیاز بگیر</h1>' +
      '<p>یک دورهمی هیجان‌انگیز با کلمه‌ها، تایمر و رقابت تیمی. حالت بازی‌ات را انتخاب کن و سریع شروع کن.</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn btn-primary btn-lg btn-hero" id="cta-play">' + Icons.get('play') + ' شروع سریع ادابازی</button>' +
      '</div>' +
      '</section>'
    ));

    /* حالت‌های بازی */
    el.appendChild(h(
      '<div class="home-section-head">' +
      '<div><h2>حالت‌های بازی</h2><p>انتخاب کن و تنظیمات را مشخص کن</p></div>' +
      '</div>'
    ));
    var modes = h('<div class="bento-2 home-modes"></div>');
    Object.keys(TYPES).forEach(function (key) {
      var m = TYPES[key];
      var accent = key === 'boom' ? 'var(--primary-2)' : 'var(--primary)';
      var sub = key === 'boom' ? 'ریتم سریع، کلمه‌به‌کلمه' : 'کلاسیک، مناسب هر جمعی';
      var mascot = key === 'boom' ? 'explosion' : 'scroll';
      var card = h(
        '<button type="button" class="mode-card mode-card-' + key + '" data-type="' + key + '" style="--orb:' + accent + '">' +
        '<div class="mode-card-top">' +
        '<span class="mode-mascot">' + A3D.img(mascot, 'a3d-lg') + '</span>' +
        '<span class="mode-chip">' + Icons.get('play') + ' شروع</span>' +
        '</div>' +
        '<div class="mode-card-body">' +
        '<h3>' + m.title + '</h3>' +
        '<p>' + m.desc + '</p>' +
        '<span class="mode-sub">' + sub + '</span>' +
        '</div>' +
        '</button>'
      );
      card.addEventListener('click', function () { beep('click'); pendingType = key; go('create'); });
      modes.appendChild(card);
    });
    el.appendChild(modes);

    /* آمار کاربر — یک کارت فشرده */
    var statCard = h(
      '<section class="card stats-compact home-stats">' +
      '<div class="stats-compact-head">' +
      '<span class="stats-title">' + Icons.get('chart') + ' <span>آمار شما</span></span>' +
      '<span class="stats-note">روی همین دستگاه</span>' +
      '</div>' +
      '<div class="stats-row">' +
      '<div class="sc-mini"><b>' + fa(s.games) + '</b><span>بازی</span></div>' +
      '<div class="sc-mini"><b>' + fa(s.words) + '</b><span>کلمه</span></div>' +
      '</div>' +
      '<button type="button" class="sc-history" data-history>' + Icons.get('history') + '<span>تاریخچه بازی‌ها</span><b>' + fa(Store.history.length) + '</b></button>' +
      '</section>'
    );
    el.appendChild(statCard);

    el.querySelector('#cta-play').addEventListener('click', function () { beep('click'); pendingType = 'adabazi'; go('create'); });
    el.querySelectorAll('[data-history]').forEach(function (b) {
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
    var isBoom = d.gameType === 'boom';
    var accent = isBoom ? 'var(--primary-2)' : 'var(--primary)';
    var el = h('<div class="create"></div>');

    el.appendChild(h(
      '<section class="card card-lg create-hero" style="--orb:' + accent + '">' +
      '<div class="create-hero-top">' +
      '<span class="mode-mascot create-mascot">' + A3D.img(isBoom ? 'explosion' : 'scroll', 'a3d-lg') + '</span>' +
      '<div class="create-hero-copy">' +
      '<span class="eyebrow">' + t.title + '</span>' +
      '<h1>چیدمان بازی</h1>' +
      '<p>' + esc(t.desc) + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="create-meta">' +
      '<span class="pill pill-accent">' + Icons.get(isBoom ? 'users' : 'users') + ' ' + (isBoom ? 'حالت بوم' : 'حالت نوبتی') + '</span>' +
      '<span class="pill">' + Icons.get('flag') + ' تنظیم سریع</span>' +
      '</div>' +
      '</section>'
    ));

    var fields = h('<section class="card create-panel"><div class="panel-head"><span class="panel-icon panel-icon-3d">' + A3D.img('rounds', 'a3d-sm') + '</span><div><h2>تعداد و دورها</h2><p>قبل از شروع، ترکیب گروه‌ها و تعداد دور را مشخص کن.</p></div></div><div class="panel-body" data-fields></div></section>');
    var fb = fields.querySelector('[data-fields]');
    var groupsStepper = stepper(isBoom ? 'تعداد بازیکن' : 'تعداد گروه', d.groups, 2, 6, function (v) {
      d.groups = v;
      paintFoot();
    }, isBoom ? 'هر بازیکن به‌نوبت گوشی را می‌گیرد' : 'گروه‌ها به‌صورت نوبتی بازی می‌کنند');
    var roundsStepper = stepper('تعداد دور', d.rounds, 1, 10, function (v) { d.rounds = v; }, 'هر دور یک نوبت برای هر گروه/بازیکن');
    fb.appendChild(groupsStepper);
    fb.appendChild(roundsStepper);
    el.appendChild(fields);

    var timeCard = h('<section class="card create-panel"><div class="panel-head"><span class="panel-icon panel-icon-3d">' + A3D.img('hourglass', 'a3d-sm') + '</span><div><h2>' + (isBoom ? 'زمان هر کلمه' : 'زمان اضافه هر نوبت') + '</h2><p>' + (isBoom ? 'مهلت اجرا برای هر کلمه در حالت بوم' : 'این زمان به زمان ثابت هر دسته اضافه می‌شود') + '</p></div></div><div class="panel-body"><div class="seg create-seg" id="more-row"></div></div></section>');
    var seg = timeCard.querySelector('#more-row');
    var moreOpts = isBoom ? [5, 6, 7] : [0, 15, 30, 45];
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
    el.appendChild(timeCard);

    var tip = h('<div class="create-tip">' + Icons.get('spark') + '<span>نام‌ها خودکار ساخته می‌شوند و بعد از شروع، جریان نوبت‌ها مطابق منطق اصلی بازی پیش می‌رود.</span></div>');
    el.appendChild(tip);

    var foot = h('<p class="foot" data-foot></p>');
    el.appendChild(foot);
    function paintFoot() {
      var label = isBoom ? 'بازیکن' : 'گروه';
      foot.textContent = 'نام ' + label + '‌ها خودکار ساخته می‌شود: ' + label + ' ' + fa(1) + ' تا ' + fa(d.groups) + '.';
    }
    paintFoot();

    var dock = h('<div class="dock create-dock"></div>');
    var start = h('<button type="button" class="btn btn-primary btn-lg btn-block">' + Icons.get('play') + ' شروع بازی</button>');
    start.addEventListener('click', function () { beginGame(); });
    dock.appendChild(start);
    el.appendChild(dock);

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
    celebrated = false;
    turnsPlayed = 0;
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
    /* شروع نوبت اول — با صفحه‌ی انتقال نوبت تا تیم اول بداند نوبت اوست */
    engine.continueTurn();
    if (engine.gameType === 'boom') { engine.startBoom(); go('boom'); }
    else go('team');
  }

  /* ---------- نوار وضعیت چسبان: نوبت فعلی، دور و امتیازها ---------- */
  function openScoresSheet() {
    if (!engine) return;
    beep('click');
    var body = '<div class="list stagger-in" style="margin-top:var(--s-2)">';
    engine.teams.forEach(function (t, i) {
      var row = teamRow(t, i === engine.turnIndex);
      row = row.replace('<div class="team-row', '<div style="--i:' + i + '" class="team-row');
      body += row;
    });
    body += '</div>';
    body += '<p class="u-center u-faint u-mt-4" style="margin-bottom:0">دور ' + fa(currentRound()) + ' از ' + fa(engine.rounds) + '</p>';
    modal({
      title: 'امتیازات',
      icon: 'trophy',
      iconColor: '#E9C46A',
      body: body,
      dismiss: true,
      actions: [{ label: 'بستن', cls: 'btn-primary btn-block' }]
    });
  }

  function hud() {
    var team = engine.team(engine.turnIndex);
    var color = TEAM_COLORS[team.color].v;
    var el = h(
      '<button type="button" class="hud" aria-label="مشاهده امتیازات">' +
      '<span class="hud-main">' +
      '<span class="hud-team" style="--team:' + color + '"><span class="hud-dot" style="--team:' + color + '"></span>' + Icons.get('users') + ' ' + esc(team.name) + '</span>' +
      '<span class="hud-round">' + Icons.get('flag') + ' دور ' + fa(currentRound()) + ' از ' + fa(engine.rounds) + '</span>' +
      '</span>' +
      '<span class="hud-action">' + Icons.get('trophy') + ' <b>امتیازات</b></span>' +
      '</button>'
    );
    el.addEventListener('click', openScoresSheet);
    return el;
  }

  /* ---------------- انتقال نوبت (بین تیم‌ها) ---------------- */

  function renderTeam() {
    if (engine.isOver()) { return renderRank(); }

    var el = h('<div class="handover-screen"></div>');
    var upNext = engine.team(engine.turnIndex);
    var upColor = TEAM_COLORS[upNext.color].v;

    el.appendChild(h(
      '<section class="card handover-hero" style="--team:' + upColor + '">' +
      '<div class="handover-top">' +
      '<span class="handover-3d">' + A3D.img('token', 'a3d-lg') + '</span>' +
      '<div class="handover-copy">' +
      '<span class="eyebrow">نوبت بعدی</span>' +
      '<h1>' + esc(upNext.name) + '</h1>' +
      '<p>امتیاز ' + fa(upNext.score) + ' · دور ' + fa(currentRound()) + ' از ' + fa(engine.rounds) + '</p>' +
      '</div>' +
      '</div>' +
      '</section>'
    ));

    var list = h('<div class="list handover-board"></div>');
    engine.teams.forEach(function (t, i) {
      list.appendChild(h(teamRow(t, i === engine.turnIndex)));
    });
    el.appendChild(list);

    var dock = h('<div class="dock handover-dock"></div>');
    var cta = h('<button type="button" class="btn btn-primary btn-lg btn-block">' +
      Icons.get('play') + ' شروع نوبت «' + esc(upNext.name) + '»</button>');
    cta.addEventListener('click', function () {
      beep('start');
      vibrate(20);
      go(engine.gameType === 'boom' ? 'boom' : 'category');
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

  /* آسن سه‌بعدی هر گروه دسته‌بندی — از پک 3D Game UI Icons */
  var CAT_GROUP_3D = {
    'سرعتی': 'lightning',
    'ضرب المثل': 'scroll',
    'کلمه': 'book',
    'ترانه': 'heart'
  };

  function renderCategory() {
    var el = h('<div class="category-screen"></div>');

    el.appendChild(hud());

    el.appendChild(h(
      '<section class="card category-intro">' +
      '<div class="category-intro-top"><span class="eyebrow">انتخاب نوبت</span><span class="pill">' + Icons.get('grid') + ' یک دسته انتخاب کن</span></div>' +
      '<div class="category-intro-main">' +
      '<span class="category-3d">' + A3D.img('book', 'a3d-md') + '</span>' +
      '<div class="category-intro-copy">' +
      '<h1>برای این نوبت چه چیزی اجرا می‌شود؟</h1>' +
      '<p>دسته را انتخاب کن؛ اگر امتیاز متغیر دارد، در مرحله بعد سطح امتیاز را مشخص می‌کنی.</p>' +
      '</div>' +
      '</div>' +
      '</section>'
    ));

    el.appendChild(h(
      '<div class="cat-tools card">' +
      '<label class="cat-search-wrap"><span class="cat-search-icon">' + Icons.get('target') + '</span><input type="search" id="cat-search" class="cat-search" placeholder="جست‌وجوی دسته…" autocomplete="off" aria-label="جست‌وجوی دسته"></label>' +
      '<button type="button" class="chip chip-sm cat-filter" id="cat-free" aria-pressed="false">' + Icons.get('eye') + ' فقط آزادها</button>' +
      '</div>'
    ));

    var wrap = h('<div class="category-wrap"></div>');
    categoryGroups().forEach(function (g) {
      /* ردیف مستقل «تصادفی» — بدون نشانگر وضعیت */
      if (g.random) {
        var rc = g.items[0];
        var ric = CAT_ICON[rc.cid] || 'dice';
        var rTile = h(
          '<button type="button" class="cat-tile wide cat-random" style="--cat:' + rc.color + '" data-name="' + esc(rc.fa) + '" data-used="0">' +
          '<span class="cat-ic cat-ic-3d">' + A3D.img('token', 'a3d-md') + '</span>' +
          '<span class="cat-copy"><span class="cat-name">' + esc(rc.fa) + '</span><span class="cat-hint">یک انتخاب شانسی از دسته‌ها</span></span>' +
          '<span class="cat-go">' + Icons.get('play') + '</span>' +
          '</button>'
        );
        rTile.addEventListener('click', function () { openCatDialog(rc); });
        var rSec = h('<div class="cat-section cat-section-random"><div class="cat-grid"></div></div>');
        rSec.querySelector('.cat-grid').appendChild(rTile);
        wrap.appendChild(rSec);
        return;
      }
      var sec = h(
        '<div class="cat-section">' +
        '<div class="section-head cat-group-head" style="margin-top:0">' +
        '<span class="sh-bar" style="background:' + g.color + '"></span>' +
        '<span class="cat-group-3d">' + A3D.img(CAT_GROUP_3D[g.name] || 'token', 'a3d-sm') + '</span>' +
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
        var freeCount = used.filter(function (u) { return !u; }).length;
        var dots = used.map(function (u) { return '<i class="dot' + (u ? ' is-used' : '') + '" aria-hidden="true"></i>'; }).join('');
        var dotLabel = freeCount === 0
          ? 'همه‌ی امتیازهای این دسته برای این تیم استفاده شده'
          : fa(freeCount) + ' امتیاز از ' + fa(used.length) + ' برای این تیم باقی مانده';
        var tile = h(
          '<button type="button" class="cat-tile' + (allUsed ? ' is-done' : '') + '" style="--cat:' + c.color + '"' +
          ' data-name="' + esc(c.fa) + '" data-used="' + (allUsed ? '1' : '0') + '"' +
          (allUsed ? ' aria-disabled="true"' : '') + '>' +
          '<span class="cat-ic' + (c.cid === 40 ? ' cat-ic-3d' : '') + '">' +
          (c.cid === 40 ? A3D.img('lightning', 'a3d-md') : Icons.get(ic)) + '</span>' +
          '<span class="cat-name">' + esc(c.fa) + '</span>' +
          '<span class="cat-dots" aria-label="' + dotLabel + '" title="' + dotLabel + '">' + dots + '</span>' +
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

    /* جست‌وجو + فیلتر «فقط آزادها» */
    var input = el.querySelector('#cat-search');
    var freeBtn = el.querySelector('#cat-free');
    var onlyFree = false;
    function applyFilter() {
      var q = (input.value || '').trim();
      var visible = 0;
      wrap.querySelectorAll('.cat-tile').forEach(function (t) {
        var name = t.getAttribute('data-name') || '';
        var used = t.getAttribute('data-used') === '1';
        var match = (!q || name.indexOf(q) > -1) && (!onlyFree || !used);
        t.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      /* اگر هیچ چیزی نماند، پیام بده */
      var empty = el.querySelector('#cat-empty');
      if (empty) empty.hidden = visible > 0;
      /* گروه‌های خالی پنهان شوند */
      wrap.querySelectorAll('.cat-section').forEach(function (sec) {
        var any = [...sec.querySelectorAll('.cat-tile')].some(function (t) { return t.style.display !== 'none'; });
        sec.style.display = any ? '' : 'none';
      });
    }
    if (input) input.addEventListener('input', applyFilter);
    if (freeBtn) freeBtn.addEventListener('click', function () {
      onlyFree = !onlyFree;
      freeBtn.classList.toggle('is-on', onlyFree);
      freeBtn.setAttribute('aria-pressed', onlyFree ? 'true' : 'false');
      applyFilter();
      beep('click');
    });
    el.appendChild(h('<div class="empty card" id="cat-empty" hidden><div>دسته‌ای با این نام پیدا نشد</div></div>'));

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

    var opts = engine.cardOptions(c);
    var used = opts.map(function (sc) { return engine.isCardUsed(engine.turnIndex, c.cid, sc); });

    /* دسته‌های با امتیاز ثابت: بدون دیالوگ، مستقیم شروع می‌شود */
    if (c.score !== 0) {
      launchTurn(c.cid, c.score);
      return;
    }

    var body =
      '<div class="sheet-pick score-pick" style="--orb:' + c.color + '">' +
      '<span class="sp-name">' + title + '</span>' +
      '</div>' +
      '<p class="u-center u-faint u-mb-2">سطح امتیاز این نوبت را انتخاب کن</p>' +
      '<p class="u-center u-faint u-mb-4" style="font-size:12.5px">هر سطح برای هر تیم یک‌بار قابل انتخاب است.</p>' +
      '<div class="chip-row score-chip-row" id="sc-row" style="justify-content:center"></div>';

    var scrim = modal({
      title: 'انتخاب امتیاز',
      icon: ic,
      iconColor: c.color,
      body: body,
      dismiss: true,
      actions: [
        { label: 'انصراف', cls: 'btn-ghost btn-block' }
      ]
    });

    var row = scrim.querySelector('#sc-row');
    opts.forEach(function (sc, idx) {
      var chip = h('<button type="button" class="chip chip-lg' + (used[idx] ? ' is-used' : '') + '"' +
        ' data-sc="' + (idx + 1) + '"' + (used[idx] ? ' disabled aria-disabled="true"' : '') + '>' +
        fa(sc) + ' امتیازی' + (used[idx] ? ' ✓' : '') + '</button>');
      chip.addEventListener('click', function () {
        if (used[idx]) { toast('این امتیاز از «' + c.fa + '» برای این تیم استفاده شده'); return; }
        beep('click');
        vibrate(12);
        closeModal();
        launchTurn(c.cid, sc);
      });
      row.appendChild(chip);
    });
  }

  function launchTurn(cid, score) {
    var t = engine.startTurn(cid, score);
    catSel = null;
    if (!t) {
      /* محتوایی نمانده: در همان صفحه‌ی دسته می‌مانیم تا نوبت تیم از بین نرود */
      toast('برای این دسته کلمه‌ای نمانده — دسته‌ی دیگری انتخاب کنید');
      return;
    }
    beep('start');
    go('play');
  }

  /* ---------------- نوبت ادابازی ---------------- */

  function renderPlay() {
    var t = engine.turn;
    var isSpeed = t.cid === 40;
    var el = h('<div class="play-screen"></div>');

    var stage = h('<div class="play-landscape"></div>');

    /* تایمر داخل کارت کلمه — همه‌چیز در یک نگاه و بدون اسکرول */
    var wordCard = h(
      '<div class="spotlight" id="word-card">' +
      '<div class="w-gauge">' + gaugeMarkup(t.stableTime, 'gauge') + '</div>' +
      '<div class="w-main">' +
      '<div class="w-meta" id="w-meta"></div>' +
      '<div class="w-text" id="w-text">کلمه مخفی است</div>' +
      '<div class="w-sub" id="w-sub"></div>' +
      '</div>' +
      '</div>'
    );

    var bigBtn = h('<button type="button" class="btn btn-primary btn-lg btn-block" id="big-btn"></button>');

    var controls = h('<div class="controls" id="controls"></div>');

    /* ستون کناری: دکمه‌ی اصلی + کنترل‌ها (در افقی کنار کارت کلمه می‌نشیند) */
    var side = h('<div class="play-side"></div>');
    side.appendChild(bigBtn);
    side.appendChild(controls);

    stage.appendChild(wordCard);
    stage.appendChild(side);

    el.appendChild(hud());
    el.appendChild(stage);

    function paintWord() {
      var meta = wordCard.querySelector('#w-meta');
      var txt = wordCard.querySelector('#w-text');
      var sub = wordCard.querySelector('#w-sub');
      meta.innerHTML = '';
      wordCard.classList.toggle('is-hidden', t.state === 1);
      wordCard.classList.toggle('is-live', t.state === 3);
      if (t.state === 1) {
        txt.textContent = 'کلمه مخفی است';
        txt.classList.remove('len-m', 'len-l', 'len-xl');
        sub.textContent = '';
        return;
      }
      if (isSpeed) {
        meta.appendChild(h('<span class="play-3d">' + A3D.img('crosshair', 'a3d-sm') + '</span>'));
        meta.appendChild(h('<span class="score-badge">' + A3D.img('star', 'a3d-xs') + '<span>' + fa(t.word.score) + ' امتیاز</span></span>'));
        var cat = data.categories.filter(function (c) { return c.cid === t.word.cid; })[0];
        meta.appendChild(h('<span class="tag">' + (cat ? esc(cat.fa) : 'سرعتی') + '</span>'));
        meta.appendChild(h('<span class="tag">' + (t.score === 99 ? fa(t.speedIndex) : fa(t.speedIndex) + ' از ' + fa(t.speedList.length)) + '</span>'));
      } else {
        meta.appendChild(h('<span class="score-badge">' + A3D.img('star', 'a3d-xs') + '<span>' + fa(t.wordScore) + ' امتیاز</span></span>'));
        if (t.cid === 69) {
          var c69 = data.categories.filter(function (c) { return c.cid === t.word.cid; })[0];
          if (c69) meta.appendChild(h('<span class="tag">' + esc(c69.fa) + '</span>'));
        } else if (t.cid === 50) {
          meta.appendChild(h('<span class="tag">ضرب‌المثل</span>'));
        } else if (t.cid === 60) {
          meta.appendChild(h('<span class="tag">ترانه</span>'));
        } else {
          var cName = data.categories.filter(function (c) { return c.cid === t.cid && c.design !== 0; })[0];
          if (cName) meta.appendChild(h('<span class="tag">' + esc(cName.fa) + '</span>'));
        }
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
      else if (t.state === 2) { label = 'شروع تایمر و اجرا'; icon = 'play2'; cls = 'btn-primary'; }
      else if (isSpeed) { label = 'تایمر در حال اجرا'; icon = 'pause'; cls = 'btn-ghost'; }
      else if (t.running) { label = 'پایان نوبت'; icon = 'flag'; cls = 'btn-danger'; }
      else { label = 'نتیجه نوبت'; icon = 'check'; cls = 'btn-ghost'; }
      bigBtn.className = 'btn ' + cls + ' btn-lg btn-block';
      bigBtn.innerHTML = Icons.get(icon) + '<span>' + label + '</span>';
      bigBtn.disabled = (isSpeed && t.state === 3) || (t.state === 4) || (t.state === 3 && !t.running && !isSpeed);
    }

    function paintControls() {
      controls.innerHTML = '';
      if (t.state === 1) return;
      if (isSpeed) {
        addBtn('btn-success', 'check', 'درست', function () {
          var r = engine.speedTrue();
          if (r === 'dialog') { stopTimer(); openSpeedDialog(); return; }
          beep('correct'); vibrate(14);
          fx(wordCard, 'fx-correct', 550);
          repaint();
          fx(el.querySelector('#w-text'), 'reveal-pop', 450);
        }, 'c-speed-ok');
        addBtn('btn-ghost', 'skip', 'رد شدن', function () {
          var r = engine.speedChange();
          if (r === 'dialog') { stopTimer(); openSpeedDialog(); return; }
          beep('skip'); vibrate(10);
          repaint();
          fx(el.querySelector('#w-text'), 'reveal-pop', 450);
        }, 'c-speed-change');
        addBtn('btn-danger', 'x', 'خطا (' + fa(Math.min(3, -t.wrongCounter)) + ')', function () {
          var r = engine.speedFault();
          if (r === 'faultout') { stopTimer(); fx(wordCard, 'fx-shake', 450); beep('wrong'); vibrate(300); openResultDialog(true); return; }
          beep('wrong'); vibrate([18, 40, 18]);
          fx(wordCard, 'fx-shake', 450);
          repaint();
        }, 'c-speed-fault');
      } else {
        if (!(t.cid === 50 && t.score === 20)) {
          /* تعویض کلمه فقط پیش از شروع تایمر */
          var canSwap = (t.state !== 3);
          var swapBtn = addBtn('btn-ghost', 'swap', 'تعویض کلمه' + (t.changeState ? ' (' + fa(t.changeState) + ')' : ''), function () {
            if (!canSwap) { toast('حین اجرای تایمر نمی‌شود کلمه را عوض کرد'); return; }
            if (engine.change()) { beep('click'); vibrate(10); repaint(); }
          });
          if (swapBtn && !canSwap) {
            swapBtn.disabled = true;
            swapBtn.setAttribute('aria-disabled', 'true');
            swapBtn.title = 'پس از شروع تایمر قفل می‌شود';
          }
        }
        if (t.cid === 50) {
          addBtn('btn-ghost', 'timer', 'زمان اضافه +۳۰ث' + (t.extraTimeState ? ' (' + fa(t.extraTimeState) + ')' : ''), function () {
            if (engine.extraTime()) { beep('click'); paintTimer(); repaint(); }
          });
        }
        addBtn('btn-danger', 'x', 'خطا' + (t.wrongCounter ? ' (' + fa(t.wrongCounter) + ')' : ''), function () {
          var r = engine.fault();
          if (r === 'faultout') { stopTimer(); fx(wordCard, 'fx-shake', 450); beep('wrong'); vibrate(300); openResultDialog(true); return; }
          beep('wrong'); vibrate([18, 40, 18]);
          fx(wordCard, 'fx-shake', 450);
          paintTimer(); repaint();
        });
      }
    }

    function addBtn(cls, icon, label, fn, id) {
      var b = h('<button type="button" class="btn ' + cls + '"' + (id ? ' id="' + id + '"' : '') + '>' + Icons.get(icon) + '<span>' + label + '</span></button>');
      b.addEventListener('click', fn);
      controls.appendChild(b);
      return b;
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
        fx(el.querySelector('#w-text'), 'reveal-pop', 500);
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
        iconColor: '#6C21ED',
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

      function paintRows(animate) {
        scrim.querySelector('#res-rows').innerHTML = rowsHTML();
        var totalEl = scrim.querySelector('.score-total span');
        if (totalEl) countUp(totalEl, engine.total(), animate === false ? 0 : 700);
      }
      paintRows(true);

      function finish() {
        var total = engine.total();
        var s = engine.commitTurn(total);
        turnsPlayed++;
        pulseHUD();
        closeModal();
        if (s.type === 'end') { go('rank'); return; }
        /* نوبت بعدی مستقیم: یک کلیک کمتر در هر دور */
        engine.continueTurn();
        go('team');
        toast('امتیاز ثبت شد: ' + (total >= 0 ? '+' : '') + fa(total));
      }

      if (!faultOut) {
        var ok = h('<button type="button" class="btn btn-primary">' + Icons.get('check') + '<span>درست</span></button>');
        ok.addEventListener('click', function () {
          engine.dialogRight();
          beep('correct');
          vibrate(20);
          paintRows(true);
          ok.disabled = true;
          no.disabled = true;
          toast('پاداش زمان اضافه شد: ' + fa(Math.floor(t.timeLeft / 30)));
          setTimeout(finish, 900);
        });
        var no = h('<button type="button" class="btn btn-danger">' + Icons.get('x') + '<span>غلط</span></button>');
        no.addEventListener('click', function () {
          engine.dialogWrong();
          beep('wrong');
          vibrate(30);
          paintRows(true);
          ok.disabled = true;
          no.disabled = true;
          setTimeout(finish, 900);
        });
        actions.appendChild(ok);
        actions.appendChild(no);
      } else {
        /* سه خطا: خودکار ادامه می‌دهد */
        setTimeout(finish, 1200);
      }
    }

    /* دیالوگ نتیجه سرعتی */
    function openSpeedDialog() {
      var sum = engine.speedTotal();
      var rightCount = t.speedList.filter(function (x) { return x.right; }).length;
      var total = t.speedList.length;

      var body = '<div class="speed-summary">' +
        '<span class="speed-chip is-ok"><b>' + fa(rightCount) + '</b> کلمه درست</span>' +
        '<span class="speed-chip is-no"><b>' + fa(total - rightCount) + '</b> رد شد</span>' +
        '<span class="speed-chip"><b>' + fa(total) + '</b> کلمه</span>' +
        '</div>';
      body += '<div class="speed-list">';
      t.speedList.forEach(function (x) {
        body += '<div class="score-row" style="--dot:' + (x.right ? 'var(--success)' : 'var(--danger)') + '">' +
          '<span class="sr-dot"></span>' +
          '<span class="sr-name">' + esc(x.word.text) + '</span>' +
          '<span class="sr-val">' + (x.right ? '+' + fa(x.word.score) : '—') + '</span>' +
          '</div>';
      });
      body += '</div><div class="score-total"><b>جمع کل</b><span id="speed-total">۰</span></div>';

      var scrim = modal({
        title: 'نتیجه سرعتی',
        icon: 'bolt',
        iconColor: '#6C21ED',
        body: body,
        dismiss: false,
        actions: []
      });
      var totalEl = scrim.querySelector('#speed-total');
      if (totalEl) countUp(totalEl, sum, 700);
      /* بدون دکمه — خودکار ادامه می‌دهد */
      setTimeout(function () {
        var s = engine.commitTurn(sum);
        turnsPlayed++;
        pulseHUD();
        closeModal();
        if (s.type === 'end') { go('rank'); return; }
        engine.continueTurn();
        go('team');
        toast('امتیاز ثبت شد: ' + (sum >= 0 ? '+' : '') + fa(sum));
      }, 2400);
    }
  }

  /* ---------------- بوم ---------------- */

  function renderBoom() {
    var b = engine.boom;
    var el = h('<div class="play-screen boom-screen"></div>');

    el.appendChild(hud());
    el.appendChild(h(
      '<div class="boom-status card">' +
      '<span class="boom-3d">' + A3D.img('explosion', 'a3d-sm') + '</span>' +
      '<span class="pill pill-accent boom-holder" id="boom-player">' + Icons.get('users') + ' ' + esc(engine.team(b.active).name) + '</span>' +
      '<span class="boom-status-meta">' + Icons.get('flag') + ' دور <span id="boom-round">' + fa(currentRound()) + '</span> از ' + fa(engine.rounds) + '</span>' +
      '</div>'
    ));

    var wordCard = h(
      '<div class="spotlight boom-spot" id="word-card">' +
      '<div class="w-gauge">' + gaugeMarkup(engine.moreTime, 'gauge') + '</div>' +
      '<div class="w-main">' +
      '<div class="w-head">سه</div>' +
      '<div class="w-text" id="w-text">' + esc(b.word || '') + '</div>' +
      '<div class="w-sub">هر کسی «سه» را گفت، گوشی دست اوست</div>' +
      '</div>' +
      '</div>'
    );

    var bigBtn = h('<button type="button" class="btn btn-primary btn-lg btn-block" id="big-btn"></button>');
    var controls = h('<div class="controls" id="controls"></div>');

    /* همان ساختار صفحه‌ی بازی: کارت کلمه + ستون دکمه و کنترل‌ها */
    var stage = h('<div class="play-landscape"></div>');
    var side = h('<div class="play-side"></div>');
    side.appendChild(bigBtn);
    side.appendChild(controls);

    stage.appendChild(wordCard);
    stage.appendChild(side);
    el.appendChild(stage);

    function paint() {
      var holder = engine.team(b.state === 1 ? b.player : b.active);
      var pill = el.querySelector('#boom-player');
      if (pill) pill.innerHTML = Icons.get('users') + ' ' + esc(holder.name);

      var txt = el.querySelector('#w-text');
      if (b.word) {
        if (txt) txt.textContent = b.word;
        var len = b.word.length;
        if (txt) {
          txt.classList.toggle('len-m', len > 14 && len <= 30);
          txt.classList.toggle('len-l', len > 30 && len <= 70);
          txt.classList.toggle('len-xl', len > 70);
        }
      } else if (txt) {
        txt.textContent = '—';
      }

      var num = el.querySelector('#timer-num');
      if (num) num.textContent = mmss(b.state === 1 ? engine.moreTime : b.timeLeft);
      paintGauge(el.querySelector('#gauge'), b.state === 1 ? engine.moreTime : b.timeLeft, engine.moreTime, b.running);

      var round = el.querySelector('#boom-round');
      if (round) round.textContent = fa(currentRound());

      bigBtn.className = 'btn btn-lg btn-block';
      if (b.state === 1) {
        bigBtn.innerHTML = Icons.get('eye') + '<span>شروع نوبت</span>';
        bigBtn.classList.add('btn-primary');
        bigBtn.disabled = false;
      } else if (b.state === 2) {
        bigBtn.innerHTML = Icons.get('play2') + '<span>شروع ' + fa(engine.moreTime) + ' ثانیه‌ای</span>';
        bigBtn.classList.add('btn-primary');
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
          fx(wordCard, 'fx-shake', 450);
          beep('wrong');
          vibrate(30);
          pulseHUD();
          afterBoom();
        });
        controls.appendChild(no);
      }
    }

    function afterBoom() {
      turnsPlayed++;
      var next = engine.boomNext();
      if (next === 'end') { paint(); go('rank'); return; }
      paint();
      beep('click');
      fx(el.querySelector('#w-text'), 'reveal-pop', 450);
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
        fx(wordCard, 'fx-correct', 550);
        beep('correct');
        vibrate(20);
        toast('+' + fa(gain) + ' امتیاز');
        pulseHUD();
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

  function shareResult() {
    if (!engine || !engine.rank) { toast('نتیجه‌ای برای اشتراک وجود ندارد'); return; }
    var rank = engine.rank();
    var lines = ['نتیجه بازی ادابازی'];
    rank.forEach(function (t, i) { lines.push(fa(i + 1) + '. ' + t.name + ': ' + fa(t.score)); });
    var text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: 'ادابازی', text: text }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('نتیجه کپی شد'); }, function () { toast(text); });
      return;
    }
    toast('امکان اشتراک در این دستگاه فعال نیست');
  }

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

    var el = h('<div class="rank-screen"></div>');

    var head = h(
      '<section class="card card-lg rank-hero u-center">' +
      '<span class="rank-3d">' + A3D.img(isTie ? 'heart' : 'trophy', 'a3d-lg') + '</span>' +
      '<span class="eyebrow" style="justify-content:center">پایان بازی</span>' +
      '<h1>' + (isTie ? 'نتیجه مساوی شد!' : 'قهرمان این دور') + '</h1>' +
      '<p>' + (isTie ? 'هیچ برنده قطعی‌ای نبود — رقابت نزدیک بود.' : esc(winner.name) + ' با بهترین عملکرد بازی را تمام کرد.') + '</p>' +
      '</section>'
    );
    el.appendChild(head);

    /* تاپ‌لیک سه نفره */
    if (rank.length >= 3) {
      var order = [rank[1], rank[0], rank[2]];
      var classes = ['pod-2', 'pod-1', 'pod-3'];
      var podium = h('<div class="podium rank-podium"></div>');
      order.forEach(function (t, i) {
        podium.appendChild(h(
          '<div class="pod ' + classes[i] + '" style="--team:' + TEAM_COLORS[t.color].v + '">' +
          (i === 1 ? '<span class="p-crown">' + A3D.img('crown', 'a3d-sm') + '</span>' : '') +
          '<span class="p-rank">' + fa(i === 1 ? 1 : (i === 0 ? 2 : 3)) + '</span>' +
          '<span class="p-avatar">' + esc(initialOf(t.name)) + '</span>' +
          '<span class="p-name">' + esc(t.name) + '</span>' +
          '<span class="p-score" data-target="' + t.score + '">۰</span>' +
          '</div>'
        ));
      });
      el.appendChild(podium);
    }

    /* فهرست کامل */
    var list = h('<div class="list rank-list"></div>');
    rank.forEach(function (t, i) {
      var row = h(teamRow(t, false, '<span class="rank-badge">رتبه ' + fa(i + 1) + '</span>'));
      row.style.setProperty('--i', i);
      var sc = row.querySelector('.tr-score');
      if (sc) { sc.dataset.target = t.score; sc.textContent = '۰'; }
      list.appendChild(row);
    });
    el.appendChild(list);

    /* کنش‌ها */
    var actions = h('<div class="rank-actions"></div>');
    var shareBtn = h('<button type="button" class="mode-card rank-action-card">' +
      '<span class="orb orb-sm" style="--orb:#9C6EEC">' + Icons.get('share') + '</span>' +
      '<div><h3>اشتراک نتیجه</h3><p>متن نتیجه بازی</p></div></button>');
    shareBtn.addEventListener('click', function () { shareResult(); });
    var again = h('<button type="button" class="mode-card rank-action-card">' +
      '<span class="orb orb-sm" style="--orb:#6C21ED">' + Icons.get('refresh') + '</span>' +
      '<div><h3>بازی دوباره</h3><p>با همین تنظیمات</p></div></button>');
    again.addEventListener('click', function () { beep('click'); beginGame(); });
    var home = h('<button type="button" class="mode-card rank-action-card">' +
      '<span class="mode-mascot rank-action-3d">' + A3D.img('home', 'a3d-sm') + '</span>' +
      '<div><h3>صفحه اصلی</h3><p>انتخاب حالت بازی</p></div></button>');
    home.addEventListener('click', function () { beep('click'); engine = null; go('home'); });
    actions.appendChild(shareBtn);
    actions.appendChild(again);
    actions.appendChild(home);
    el.appendChild(actions);

    setTimeout(function () {
      el.querySelectorAll('.p-score[data-target], .tr-score[data-target]').forEach(function (n, idx) {
        setTimeout(function () { countUp(n, n.dataset.target, 900); }, idx * 90);
      });
    }, 60);

    /* جشن پایان بازی — یک‌بار برای هر بازی */
    if (!celebrated) {
      celebrated = true;
      setTimeout(function () {
        if (window.Confetti) Confetti.burst(isTie ? 90 : 160);
        beep('correct');
        vibrate(isTie ? 12 : 28);
      }, 320);
    }

    render._cleanup = function () { stopTimer(); };
    return el;
  }

  /* ---------------- تاریخچه ---------------- */

  function renderHistory() {
    var el = h('<div class="simple-screen"></div>');

    el.appendChild(h(
      '<section class="card card-lg page-hero u-center">' +
      '<span class="page-hero-3d">' + A3D.img('book', 'a3d-md') + '</span>' +
      '<span class="eyebrow" style="justify-content:center">آرشیو</span>' +
      '<h1>تاریخچه بازی‌ها</h1>' +
      '<p>نتیجه بازی‌های اخیر روی همین دستگاه</p>' +
      '</section>'
    ));

    if (!Store.history.length) {
      el.appendChild(h(
        '<div class="empty card page-empty">' + Icons.get('history') +
        '<div>هنوز بازی‌ای انجام نشده</div><span>بعد از اولین بازی، نتیجه‌ها اینجا نمایش داده می‌شوند.</span></div>'
      ));
      return el;
    }

    var list = h('<div class="list u-mt-3"></div>');
    Store.history.slice().reverse().forEach(function (g) {
      var isBoom = g.mode === 'boom';
      list.appendChild(h(
        '<div class="hist-item">' +
        '<span class="h-icon">' + Icons.get(isBoom ? 'bolt' : 'book') + '</span>' +
        '<span class="h-main"><strong>' + esc(g.winner || '—') + '</strong>' +
        '<span>' + (isBoom ? 'بوم' : 'ادابازی') + ' · ' + fa(g.rounds || 0) + ' دور · ' + fa(g.words || 0) + ' کلمه</span></span>' +
        '<span class="h-score">' + fa(g.score || 0) + '</span>' +
        '</div>'
      ));
    });
    el.appendChild(list);

    var clear = h('<button type="button" class="btn btn-ghost btn-block u-mt-3">' + Icons.get('trash') + ' پاک کردن تاریخچه</button>');
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
    var el = h('<div class="simple-screen"></div>');

    el.appendChild(h(
      '<section class="card card-lg page-hero u-center">' +
      '<span class="page-hero-3d">' + A3D.img('cog', 'a3d-md') + '</span>' +
      '<span class="eyebrow" style="justify-content:center">تنظیمات</span>' +
      '<h1>تجربه بازی</h1>' +
      '<p>صدا، لرزش و گزینه‌های کاربردی برنامه</p>' +
      '</section>'
    ));

    var prefs = h(
      '<section class="card settings-panel">' +
      '<div class="panel-head"><span class="panel-icon">' + Icons.get('sliders') + '</span>' +
      '<div><h2>بازخورد و حس بازی</h2><p>صدا و لرزش را مطابق سلیقه خود تنظیم کن.</p></div></div>' +
      '<div class="settings-group" data-prefs></div>' +
      '</section>'
    );
    var prefsGroup = prefs.querySelector('[data-prefs]');
    prefsGroup.appendChild(toggleRow('volume', 'صداهای بازی', 'بوق درست/غلط و پایان زمان', st.sound, function (v) {
      Store.setSetting('sound', v); GameAudio.setEnabled(v); if (v) beep('correct');
    }));
    prefsGroup.appendChild(toggleRow('spark', 'لرزش گوشی', 'بازخورد لمسی هنگام پاسخ', st.haptics, function (v) {
      Store.setSetting('haptics', v); if (v) vibrate(30);
    }));
    el.appendChild(prefs);

    var info = h(
      '<section class="card settings-panel">' +
      '<div class="panel-head"><span class="panel-icon">' + Icons.get('info') + '</span>' +
      '<div><h2>اطلاعات و داده‌ها</h2><p>درباره برنامه و مدیریت داده‌های ذخیره‌شده روی دستگاه</p></div></div>' +
      '<div class="settings-group">' +
      '<button type="button" class="list-row settings-link" id="open-about">' +
      '<span class="orb orb-sm" style="--orb:#9C6EEC">' + Icons.get('info') + '</span>' +
      '<span class="lr-txt"><strong>درباره ادابازی</strong><span>حریم خصوصی و قوانین</span></span>' +
      '<span class="settings-chevron">' + Icons.get('next') + '</span>' +
      '</button>' +
      '</div>' +
      '</section>'
    );
    info.querySelector('#open-about').addEventListener('click', function () { beep('click'); go('about'); });
    el.appendChild(info);

    var danger = h(
      '<section class="card settings-panel settings-panel-danger">' +
      '<div class="panel-head"><span class="panel-icon">' + Icons.get('refresh') + '</span>' +
      '<div><h2>بازنشانی</h2><p>تنظیمات، آمار و تاریخچه به حالت اولیه برمی‌گردند.</p></div></div>' +
      '<div class="settings-group"></div>' +
      '</section>'
    );
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
    danger.querySelector('.settings-group').appendChild(resetBtn);
    el.appendChild(danger);

    return el;
  }
  function toggleRow(icon, title, sub, val, onChange) {
    var row = h(
      '<div class="setting-row">' +
      '<span class="orb orb-sm" style="--orb:#6C21ED">' + Icons.get(icon) + '</span>' +
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
    var el = h('<div class="simple-screen"></div>');

    el.appendChild(h(
      '<section class="card card-lg page-hero u-center">' +
      '<span class="page-hero-3d">' + A3D.img('heart', 'a3d-md') + '</span>' +
      '<span class="eyebrow" style="justify-content:center">درباره</span>' +
      '<h1>ادابازی</h1>' +
      '<p>بازی گروهی برای دورهمی‌ها، با تمرکز بر سادگی، سرعت و هیجان</p>' +
      '</section>'
    ));

    var list = h('<div class="list u-mt-3"></div>');
    [
      ['heart', 'بدون جمع‌آوری داده', 'همه چیز روی همین دستگاه ذخیره می‌شود.', 'var(--danger)'],
      ['book', 'منطق اپ اصلی', 'ساخت نوبت‌ها، زمان هر دسته، تعویض کلمه، خطاها و پاداش زمان.', 'var(--primary)'],
      ['grid', 'حالت‌ها و دسته‌ها', 'سرعتی، ضرب‌المثل، دسته‌های کلمه و ترانه + حالت ویژه‌ی بوم.', 'var(--primary-2)']
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

  /* رفتار مشترک دکمه‌ی بازگشت (نوار بالا و دکمه‌ی بازگشت سیستم/اندروید) */
  function handleBack() {
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
  }

  btnBack.addEventListener('click', handleBack);

  /* دکمه‌ی بازگشت سیستم (اندروید) — نباید وسط بازی اپ را ببندد */
  window.addEventListener('popstate', function () {
    if (modalRoot.lastElementChild) {
      /* اول پنجره‌ی باز بسته شود */
      closeModal();
      try { history.pushState({ app: 1 }, ''); } catch (e) { }
      return;
    }
    if (route === 'home') return;              /* در خانه: خروج عادی از اپ */
    try { history.pushState({ app: 1 }, ''); } catch (e) { }
    handleBack();
  });

  btnSettings.addEventListener('click', function () { beep('click'); go('settings'); });

  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;

    /* Space = دکمه‌ی اصلی (نمایش کلمه / شروع تایمر / پایان نوبت) */
    if (route === 'play' && e.key === ' ') {
      var main = document.getElementById('big-btn');
      if (main && !main.disabled && !modalRoot.childElementCount) {
        e.preventDefault();
        main.click();
      }
      return;
    }
    /* 1 / 2 / 3 = انتخاب امتیاز در شیت دسته */
    if (route === 'category' && /^[123]$/.test(e.key) && modalRoot.childElementCount) {
      var chip = document.querySelector('#sc-row .chip[data-sc="' + e.key + '"]');
      if (chip && !chip.disabled) { e.preventDefault(); chip.click(); }
      return;
    }

    if (route !== 'play' || !engine || !engine.turn) return;
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
    /* سرویس‌ورکر فقط در وب (در اندروید ثبت نمی‌شود تا کش قدیمی نسازد) */
    var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!isNative && 'serviceWorker' in navigator && location.protocol !== 'file:') {
      /* ?v= باعث می‌شود مرورگر نسخه‌ی جدید سرویس‌ورکر را بگیرد */
      navigator.serviceWorker.register('sw.js?v=' + APP_VERSION).catch(function () { /* بی‌صدا */ });
    }

    /* آیکون دکمه‌های نوار بالا */
    btnBack.innerHTML = Icons.get('back');
    btnSettings.innerHTML = Icons.get('settings');

    /* یک ورودی تاریخچه تا دکمه‌ی بازگشت سیستم (اندروید) داخل اپ مدیریت شود */
    try { history.pushState({ app: 1 }, ''); } catch (e) { }

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
