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
      desc: 'هر نوبت یک کلمه: تیم نوبت‌دار دسته را انتخاب می‌کند و بقیه حدس می‌زنند.',
      icon: 'book',
      glow: 'linear-gradient(150deg, #7C3AED, #4C1D95)'
    },
    boom: {
      title: 'بوم',
      desc: 'کلمه به کلمه و دست‌به‌دست؛ درست = ثانیه‌های باقی‌مانده + ۱ امتیاز.',
      icon: 'bolt',
      glow: 'linear-gradient(150deg, #F43F5E, #9F1239)'
    }
  };

  var TEAM_COLORS = [
    { v: '#7C3AED', n: 'بنفش' }, { v: '#F43F5E', n: 'قرمز' }, { v: '#22D3EE', n: 'آبی' },
    { v: '#FBBF24', n: 'زرد' }, { v: '#34D399', n: 'سبز' }, { v: '#FF4FA3', n: 'صورتی' }
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
      iconStyle = 'color:' + c + ';border-color:' + c + '55;background:linear-gradient(158deg,' + c + '26,' + c + '0d)';
    }
    var scrim = h(
      '<div class="scrim" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || 'پنجره') + '">' +
      '<div class="modal clay">' +
      (opts.icon ? '<div class="modal-icon" style="' + iconStyle + '">' + Icons.get(opts.icon) + '</div>' : '') +
      '<h2>' + esc(opts.title || '') + '</h2>' +
      (opts.body ? '<div class="m-body">' + opts.body + '</div>' : '') +
      '<div class="modal-actions"></div>' +
      '</div></div>'
    );
    var actions = scrim.querySelector('.modal-actions');
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
    { icon: 'users', title: 'بازی را بسازید', desc: 'تعداد گروه‌ها (۲ تا ۶)، تعداد دور و زمان اضافه را انتخاب کنید — دقیقاً مثل اپ اصلی.' },
    { icon: 'spark', title: 'هر نوبت یک دسته', desc: 'تیم نوبت‌دار بین سرعتی، ضرب‌المثل، دسته‌های کلمه یا ترانه انتخاب می‌کند و امتیاز کلمه را مشخص می‌کند.' },
    { icon: 'book', title: 'یک کلمه، یک نتیجه', desc: 'کلمه مخفی است؛ با «شروع تایمر» اجرا می‌شود. در پایان دیالوگ درست/غلط امتیاز را ثبت می‌کند.' }
  ];

  function sectionHead(icon, title, sub) {
    return h(
      '<div class="section-head">' +
      '<span class="sh-ic">' + Icons.get(icon) + '</span>' +
      '<span class="sh-txt"><h2>' + esc(title) + '</h2>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') +
      '</span></div>'
    );
  }

  function statRow(icon, title, sub, value, id) {
    var b = h(
      '<button type="button" class="stat-row"' + (id ? ' data-' + id : '') + '>' +
      '<span class="sr-ic">' + Icons.get(icon) + '</span>' +
      '<span class="sr-txt"><strong>' + esc(title) + '</strong><span>' + esc(sub) + '</span></span>' +
      '<span class="sr-val">' + fa(value) + '</span>' +
      '</button>'
    );
    return b;
  }

  function renderHome() {
    var s = Store.stats;
    var el = h('<div></div>');

    /* ---------- هیرو ---------- */
    el.appendChild(h(
      '<section class="clay hero">' +
      '<h1>بازی گروهی <span class="grad-text">پانتومیم و حدس کلمه</span></h1>' +
      '<p class="hero-sub">دقیقاً با همان منطق اپ اصلی ادابازی: گروه‌ها، دورها، دسته‌ها و امتیازها — بدون تبلیغات و بدون پرداخت درون‌برنامه‌ای.</p>' +
      '<div class="hero-tags">' +
      '<span class="tag">رایگان</span>' +
      '<span class="tag">بدون تبلیغات</span>' +
      '<span class="tag">' + fa(data.totals.adabazi + data.totals.proverb) + ' محتوا</span>' +
      '</div>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn btn-primary btn-lg" id="cta-play">' + Icons.get('play') + ' شروع بازی</button>' +
      '<button type="button" class="btn btn-ghost btn-lg" id="cta-boom">' + Icons.get('bolt') + ' بازی بوم</button>' +
      '</div>' +
      '<div class="hero-stats">' +
      '<div class="hs-item"><strong>' + fa(data.totals.adabazi) + '</strong><span>کلمه</span></div>' +
      '<div class="hs-item"><strong>' + fa(data.totals.proverb) + '</strong><span>ضرب‌المثل</span></div>' +
      '<div class="hs-item"><strong>' + fa(data.totals.boom) + '</strong><span>چالش بوم</span></div>' +
      '</div>' +
      '</section>'
    ));

    /* ---------- حالت‌های بازی ---------- */
    el.appendChild(sectionHead('grid', 'حالت‌های بازی', 'دو حالت، با قوانین یکسان اپ اصلی'));
    var bento = h('<div class="bento"></div>');
    Object.keys(TYPES).forEach(function (key) {
      var m = TYPES[key];
      var count = key === 'boom' ? data.totals.boom : (data.totals.adabazi + data.totals.proverb + data.totals.songs);
      var card = h(
        '<button type="button" class="clay pressable mode-card span-3" data-type="' + key + '" style="--glow:' + m.glow + '">' +
        '<span class="m-icon">' + Icons.get(m.icon) + '</span>' +
        '<h3>' + m.title + '</h3>' +
        '<p>' + m.desc + '</p>' +
        '<span class="m-count">' + fa(count) + ' محتوا</span>' +
        '</button>'
      );
      card.addEventListener('click', function () { beep('click'); pendingType = key; go('create'); });
      bento.appendChild(card);
    });
    el.appendChild(bento);

    /* ---------- چطور بازی کنیم ---------- */
    el.appendChild(sectionHead('spark', 'چطور بازی کنیم؟', 'سه قدم تا اولین دور'));
    var steps = h('<div class="how-grid"></div>');
    HOW_STEPS.forEach(function (st, i) {
      steps.appendChild(h(
        '<div class="clay how-card">' +
        '<span class="h-top"><span class="h-num">' + fa(i + 1) + '</span><span class="h-icon">' + Icons.get(st.icon) + '</span></span>' +
        '<h3>' + st.title + '</h3>' +
        '<p>' + st.desc + '</p>' +
        '</div>'
      ));
    });
    el.appendChild(steps);

    /* ---------- آمار شما ---------- */
    el.appendChild(sectionHead('chart', 'آمار شما', 'آمار بازی‌های همین دستگاه'));
    var statList = h('<div class="clay stat-list"></div>');
    statList.appendChild(statRow('chart', 'بازی‌ها', 'تعداد کل بازی‌های انجام‌شده', s.games, 'stats'));
    statList.appendChild(statRow('target', 'کلمه‌ها', 'کلمه‌های بازی‌شده', s.words, 'stats'));
    statList.appendChild(statRow('history', 'تاریخچه', 'بازی‌های اخیر', Store.history.length, 'history'));
    el.appendChild(statList);

    /* ---------- تنظیمات و درباره ---------- */
    el.appendChild(h(
      '<div class="bento" style="margin-top:var(--s-3)">' +
      '<button type="button" class="clay pressable mini-card span-2" id="open-settings" style="--glow:#34D399">' +
      '<span class="mc-icon">' + Icons.get('settings') + '</span>' +
      '<strong>تنظیمات بازی</strong><span>صدا و لرزش</span></button>' +
      '<button type="button" class="clay pressable mini-card span-2" id="open-about" style="--glow:#FBBF24">' +
      '<span class="mc-icon">' + Icons.get('info') + '</span>' +
      '<strong>درباره و حریم خصوصی</strong><span>بدون جمع‌آوری داده</span></button>' +
      '</div>'
    ));

    /* ---------- بند پایانی ---------- */
    el.appendChild(h(
      '<section class="clay cta-band">' +
      '<h2>آماده‌ای شروع کنی؟</h2>' +
      '<p>گروه‌ها را بساز، دسته را انتخاب کن و بازی را شروع کن. بدون تبلیغ، بدون خرید درون‌برنامه‌ای.</p>' +
      '<button type="button" class="btn btn-primary btn-lg btn-block" id="cta-final">' + Icons.get('play') + ' شروع بازی</button>' +
      '</section>'
    ));

    el.appendChild(h(
      '<p class="foot">ادابازی نسخه وب — کاملاً رایگان، بدون تبلیغات و بدون پرداخت درون‌برنامه‌ای.<br>' +
      'بازسازی وبِ بازی گروهی ادابازی با همان قوانین و محتوا.</p>'
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

  /* ----- ساخت بازی (CreateFragment) ----- */

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
      '<section class="clay hero" style="padding:var(--s-5)">' +
      '<div class="hero-tags"><span class="tag">' + t.title + '</span></div>' +
      '<h1 style="font-size:var(--fs-h1)">بازی جدید</h1>' +
      '<p>' + t.desc + '</p>' +
      '</section>'
    ));

    /* گروه‌ها و دورها */
    var box = h('<div style="margin-top:var(--s-5)"><div class="section-title">' + Icons.get('users') + ' چیدمان بازی</div></div>');
    box.appendChild(stepper(d.gameType === 'boom' ? 'تعداد بازیکن' : 'تعداد گروه', d.groups, 2, 6, function (v) { d.groups = v; }));
    box.appendChild(stepper('تعداد دور', d.rounds, 1, 10, function (v) { d.rounds = v; }));
    el.appendChild(box);

    /* زمان اضافه */
    var moreBox = h('<div style="margin-top:var(--s-5)"><div class="section-title">' + Icons.get('timer') +
      (d.gameType === 'boom' ? ' زمان هر کلمه' : ' زمان اضافه هر نوبت') + '</div>' +
      '<div class="chip-row" id="more-row"></div></div>');
    var moreRow = moreBox.querySelector('#more-row');
    var moreOpts = d.gameType === 'boom' ? [5, 6, 7] : [0, 15, 30, 45];
    moreOpts.forEach(function (v) {
      var chip = h('<button type="button" class="chip" data-v="' + v + '">' + fa(v) + ' ثانیه</button>');
      chip.addEventListener('click', function () {
        d.moreTime = v;
        paintMore();
        beep('click');
      });
      moreRow.appendChild(chip);
    });
    function paintMore() {
      moreRow.querySelectorAll('[data-v]').forEach(function (c) {
        c.classList.toggle('is-on', Number(c.dataset.v) === d.moreTime);
      });
    }
    paintMore();
    el.appendChild(moreBox);

    /* شروع */
    var start = h('<button type="button" class="btn btn-primary btn-lg btn-block" style="margin-top:var(--s-6)">' + Icons.get('play') + ' شروع بازی</button>');
    start.addEventListener('click', function () { beginGame(); });
    el.appendChild(start);

    el.appendChild(h('<p class="foot">نام گروه‌ها خودکار ساخته می‌شود (' + (d.gameType === 'boom' ? 'بازیکن' : 'گروه') + ' ' + fa(1) + ' تا ' + fa(d.groups) + ') — مثل اپ اصلی.</p>'));

    return el;
  }

  function stepper(label, val, min, max, onChange) {
    var wrap = h(
      '<div class="row">' +
      '<div class="r-text"><strong>' + esc(label) + '</strong></div>' +
      '<div class="stepper">' +
      '<button type="button" class="icon-btn" data-dec aria-label="کاهش">' + Icons.get('minus') + '</button>' +
      '<span class="step-val" data-val>' + fa(val) + '</span>' +
      '<button type="button" class="icon-btn" data-inc aria-label="افزایش">' + Icons.get('plus') + '</button>' +
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

  /* ----- شروع بازی ----- */

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

  /* ----- صفحه گروه (TeamFragment) ----- */

  function renderTeam() {
    if (engine.isOver()) { return renderRank(); }

    var el = h('<div></div>');
    var upNext = engine.team(engine.turnIndex);
    var upColor = TEAM_COLORS[upNext.color].v;

    el.appendChild(h(
      '<div class="play-head" style="justify-content:center;margin-bottom:var(--s-3);flex-wrap:wrap">' +
      '<span class="round-pill">' + Icons.get('flag') + ' دور ' + fa(engine.roundNumber()) + ' از ' + fa(engine.rounds) + '</span>' +
      '<span class="tag">' + TYPES[engine.gameType].title + '</span>' +
      '</div>'
    ));

    el.appendChild(h(
      '<section class="clay" style="padding:var(--s-4);margin-bottom:var(--s-3);text-align:center;background:var(--surface-2);background:linear-gradient(150deg, color-mix(in srgb, ' + upColor + ' 22%, var(--surface-2)), var(--bg-elev));border-color:' + upColor + '55">' +
      '<p class="lead" style="margin:0 0 6px">نوبت بعدی</p>' +
      '<h2 style="font-family:var(--font-display);font-size:clamp(28px,8vw,40px);margin:0;color:' + upColor + '">' + esc(upNext.name) + '</h2>' +
      '<p class="lead" style="margin:8px 0 0">امتیاز فعلی: <strong style="color:var(--text)">' + fa(upNext.score) + '</strong></p>' +
      '</section>'
    ));

    var box = h('<div class="clay" style="padding:var(--s-4)"><div class="section-title" style="margin:0 0 var(--s-3)">' + Icons.get('users') + ' جدول امتیازات</div></div>');
    engine.teams.forEach(function (t, i) {
      var isNext = i === engine.turnIndex;
      var row = h(
        '<div class="round-line" style="--team:' + TEAM_COLORS[t.color].v + ';' + (isNext ? 'border-color:' + TEAM_COLORS[t.color].v + '66;background:rgba(255,255,255,.04);background:color-mix(in srgb,' + TEAM_COLORS[t.color].v + ' 10%, transparent);' : '') + '">' +
        '<span class="rl-dot"></span>' +
        '<span class="rl-name">' + esc(t.name) +
        (isNext ? ' <span class="tag" style="margin-inline-start:6px">نوبت بعدی</span>' : '') +
        '</span>' +
        '<span class="rl-total">' + fa(t.score) + '</span>' +
        '</div>'
      );
      row.querySelector('.rl-dot').style.background = TEAM_COLORS[t.color].v;
      box.appendChild(row);
    });
    el.appendChild(box);

    var cta = h('<button type="button" class="btn btn-primary btn-lg btn-block" style="margin-top:var(--s-5);min-height:72px">' +
      Icons.get('play') + ' شروع نوبت «' + esc(upNext.name) + '»</button>');
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
    el.appendChild(cta);

    el.appendChild(h('<p class="foot">هر تیم در هر دور دقیقاً یک نوبت بازی می‌کند؛ پس از پایان همه‌ی دورها رتبه‌بندی نمایش داده می‌شود.</p>'));

    render._cleanup = function () { stopTimer(); };
    return el;
  }

  /* ----- انتخاب دسته (CategoryFragment) ----- */

  function categoryGroups() {
    /* ساخت درخت دسته‌ها از داده — دسته‌های design 0 سرگروه‌اند */
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
    /* قانون ۲۰ امتیازی: هر تیم فقط یک بار */
    var team = engine.team(engine.turnIndex);
    groups.forEach(function (g) {
      if (g.name === 'ضرب المثل' && team.proverbState) {
        g.items = g.items.filter(function (i) { return i.score !== 20; });
      }
    });
    return groups;
  }

  function catLabel(c) {
    if (c.cid === 40) return 'سرعتی - ' + esc(c.fa);
    if (c.cid === 50) return 'ضرب‌المثل\n' + esc(c.fa);
    if (c.cid === 60) return 'ترانه - ' + esc(c.fa);
    return esc(c.fa);
  }

  /* آیکون اختصاصی هر دسته — مطابق تصاویر اورجینال APK */
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
      '<div class="play-head" style="justify-content:center;margin-bottom:var(--s-3)">' +
      '<span class="turn-pill" style="--team:' + TEAM_COLORS[team.color].v + ';border-color:' + TEAM_COLORS[team.color].v + '">' +
      Icons.get('users') + ' نوبت: ' + esc(team.name) + '</span>' +
      '</div>'
    ));
    el.appendChild(h('<p class="lead" style="text-align:center">' + Icons.get('grid') + ' دسته‌ی این نوبت را انتخاب کن</p>'));

    var wrap = h('<div></div>');
    categoryGroups().forEach(function (g) {
      var card = h(
        '<div class="cat-section" style="margin-bottom:var(--s-4)">' +
        '<div class="section-title" style="margin:0 0 var(--s-3)">' +
        '<span style="width:12px;height:12px;border-radius:50%;background:' + g.color + ';box-shadow:0 0 10px ' + g.color + '"></span>' +
        '<strong style="font-family:var(--font-display);font-size:var(--fs-h3)">' + esc(g.name) + '</strong>' +
        '</div>' +
        '<div class="cat-grid"></div>' +
        '</div>'
      );
      var grid = card.querySelector('.cat-grid');
      g.items.forEach(function (c) {
        var ic = CAT_ICON[c.cid] || 'grid';
        var tile = h(
          '<button type="button" class="cat-tile clay" style="--cat:' + c.color + '">' +
          '<span class="cat-ic">' + Icons.get(ic) + '</span>' +
          '<span class="cat-name">' + esc(c.fa) + '</span>' +
          '</button>'
        );
        tile.addEventListener('click', function () { openCatDialog(c); });
        grid.appendChild(tile);
      });
      wrap.appendChild(card);
    });
    el.appendChild(wrap);

    render._cleanup = function () { stopTimer(); };
    return el;
  }

  function openCatDialog(c) {
    beep('click');
    var ic = CAT_ICON[c.cid] || 'grid';

    /* عنوان دیالوگ = اسم دسته (طبق خواسته: با انتخاب دسته، اسمش برای انتخاب امتیاز نوشته شود) */
    var title = esc(c.fa);
    if (c.cid === 40) title = 'سرعتی ' + esc(c.fa);
    if (c.cid === 50) title = 'ضرب‌المثل ' + esc(c.fa);
    if (c.cid === 60) title = 'ترانه ' + esc(c.fa);

    var body =
      '<div class="cat-dlg-head" style="--cat:' + c.color + '">' +
      '<span class="cat-ic">' + Icons.get(ic) + '</span>' +
      '<span class="cat-name" style="font-family:var(--font-display);font-size:var(--fs-h2)">' + title + '</span>' +
      '</div>' +
      '<p class="lead" style="text-align:center;margin:0 0 var(--s-3)">انتخاب امتیاز</p>' +
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
    scrim.querySelectorAll('.modal-actions .btn').forEach(function (b) {
      if (b.textContent.indexOf('ادامه') >= 0) contBtn = b;
    });

    if (c.score === 0) {
      /* دسته‌های کلمه: انتخاب امتیاز ۱/۲/۳ (پیش‌فرض: ۱ امتیازی) */
      catSel.score = 1;
      [1, 2, 3].forEach(function (sc) {
        var chip = h('<button type="button" class="chip" data-sc="' + sc + '">' + fa(sc) + ' امتیازی</button>');
        chip.addEventListener('click', function () {
          catSel.score = sc;
          paintSc();
          beep('click');
        });
        row.appendChild(chip);
      });
      function paintSc() {
        row.querySelectorAll('[data-sc]').forEach(function (ch) {
          ch.classList.toggle('is-on', Number(ch.dataset.sc) === catSel.score);
        });
      }
      paintSc();
    } else {
      /* امتیاز ثابت (سرعتی/ضرب‌المثل/ترانه): فقط ادامه */
      row.appendChild(h('<span class="tag">' + fa(c.score) + ' امتیازی</span>'));
      if (contBtn) contBtn.classList.add('btn-lg');
    }
  }

  function launchTurn() {
    var t = engine.startTurn(catSel.cid, catSel.score);
    catSel = null;
    if (!t) { toast('محتوایی برای این دسته پیدا نشد'); go('team'); return; }
    beep('start');
    go('play');
  }

  /* ----- نوبت ادابازی (AdabaziPlayFragment) ----- */

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

    var head = h(
      '<div class="play-head" style="justify-content:center">' +
      '<span class="turn-pill" style="--team:' + TEAM_COLORS[team.color].v + ';border-color:' + TEAM_COLORS[team.color].v + '">' +
      Icons.get('users') + ' ' + esc(team.name) + '</span>' +
      '<span class="round-pill">' + esc(turnCategoryName(t)) + '</span>' +
      '</div>'
    );

    var timerWrap = h(
      '<div class="timer-wrap" id="timer-wrap" style="margin-top:var(--s-3)">' +
      '<div class="timer-num" id="timer-num" style="position:static;transform:none;font-size:clamp(40px,12vw,56px)">' + mmss(t.stableTime) + '</div>' +
      '</div>'
    );

    var wordCard = h(
      '<div class="clay word-card" id="word-card">' +
      '<div class="w-meta" id="w-meta"></div>' +
      '<div class="w-text" id="w-text">کلمه مخفی است</div>' +
      '<div class="w-sub" id="w-sub"></div>' +
      '</div>'
    );

    /* دکمه بزرگ چرخه‌ای */
    var bigBtn = h('<button type="button" class="btn btn-primary btn-lg btn-block" id="big-btn" style="margin-top:var(--s-3);min-height:84px;font-size:clamp(19px,5vw,24px)">' + Icons.get('eye') + '<span>نمایش کلمه</span></button>');

    var controls = h('<div class="controls" id="controls"></div>');

    el.appendChild(head);
    el.appendChild(timerWrap);
    el.appendChild(wordCard);
    el.appendChild(bigBtn);
    el.appendChild(controls);

    function paintWord() {
      var meta = wordCard.querySelector('#w-meta');
      var txt = wordCard.querySelector('#w-text');
      var sub = wordCard.querySelector('#w-sub');
      meta.innerHTML = '';
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
      txt.style.animation = 'none';
      void txt.offsetWidth;
      txt.style.animation = '';
      sub.textContent = w.sub || '';
    }

    function paintBig() {
      var label, icon, cls;
      if (t.state === 1) { label = 'نمایش کلمه'; icon = 'eye'; cls = 'btn-primary'; }
      else if (t.state === 2) { label = 'شروع تایمر'; icon = 'play2'; cls = 'btn-skip'; }
      else if (isSpeed) { label = 'تایمر در حال اجرا'; icon = 'pause'; cls = 'btn-ghost'; }
      else { label = 'پایان نوبت (توقف)'; icon = 'flag'; cls = 'btn-ok'; }
      bigBtn.className = 'btn ' + cls + ' btn-lg btn-block';
      bigBtn.style.marginTop = 'var(--s-3)';
      bigBtn.style.minHeight = '84px';
      bigBtn.style.fontSize = 'clamp(19px,5vw,24px)';
      bigBtn.innerHTML = Icons.get(icon) + '<span>' + label + '</span>';
      bigBtn.disabled = (isSpeed && t.state === 3);
    }

    function paintControls() {
      controls.innerHTML = '';
      if (t.state === 1) return;
      if (isSpeed) {
        addBtn('ok', 'check', 'درست', function () {
          var r = engine.speedTrue();
          if (r === 'dialog') { stopTimer(); openSpeedDialog(); return; }
          beep('correct'); vibrate(14); repaint();
        }, 'c-speed-ok');
        addBtn('skip', 'skip', 'رد شدن', function () {
          var r = engine.speedChange();
          if (r === 'dialog') { stopTimer(); openSpeedDialog(); return; }
          beep('skip'); vibrate(10); repaint();
        }, 'c-speed-change');
        addBtn('bad', 'x', 'خطا (' + fa(Math.min(3, -t.wrongCounter)) + ')', function () {
          var r = engine.speedFault();
          if (r === 'faultout') { stopTimer(); beep('wrong'); vibrate(300); openResultDialog(true); return; }
          beep('wrong'); vibrate([18, 40, 18]); repaint();
        }, 'c-speed-fault');
      } else {
        if (!(t.cid === 50 && t.score === 20)) {
          addBtn('ghost', 'swap', 'تعویض کلمه' + (t.changeState ? ' (' + fa(t.changeState) + ')' : ''), function () {
            if (engine.change()) { beep('click'); vibrate(10); repaint(); }
          });
        }
        if (t.cid === 50) {
          addBtn('ghost', 'timer', 'زمان اضافه +۳۰ث' + (t.extraTimeState ? ' (' + fa(t.extraTimeState) + ')' : ''), function () {
            if (engine.extraTime()) { beep('click'); paintTimer(); repaint(); }
          });
        }
        addBtn('bad', 'x', 'خطا' + (t.wrongCounter ? ' (' + fa(t.wrongCounter) + ')' : ''), function () {
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
      var left = (t.state === 1) ? t.stableTime : t.timeLeft;
      num.textContent = mmss(left);
      num.style.color = (t.running && left <= 10) ? 'var(--rose)' : '';
      num.style.transform = (t.running && left <= 5) ? 'scale(1.06)' : '';
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
        dismiss: false,
        body: '<div id="res-rows"></div>',
        actions: []
      });
      var actions = scrim.querySelector('.modal-actions');

      function rowsHTML() {
        function row(label, v, color) {
          return '<div class="round-line" style="--team:' + (v >= 0 ? 'var(--green)' : 'var(--rose)') + '">' +
            '<span class="rl-dot" style="background:' + (color || (v >= 0 ? 'var(--green)' : 'var(--rose)')) + '"></span>' +
            '<span class="rl-name">' + label + '</span>' +
            '<span class="rl-delta" style="color:' + (v >= 0 ? 'var(--green)' : 'var(--rose)') + '">' + (v >= 0 ? '+' : '') + fa(v) + '</span>' +
            '</div>';
        }
        return row('امتیاز کلمه', t.wordScore, 'var(--violet-2)') +
          row('تعویض کلمه', t.changeState) +
          row('زمان اضافه', t.extraTimeState) +
          row('خطا', t.wrongCounter) +
          '<div class="round-line" style="border-top:3px solid var(--line)">' +
          '<span class="rl-name" style="font-family:var(--font-display);font-size:var(--fs-h3)">جمع کل</span>' +
          '<span class="rl-total" style="font-family:var(--font-display);font-size:30px;color:var(--amber)">' + fa(engine.total()) + '</span>' +
          '</div>';
      }

      function paintRows() {
        scrim.querySelector('#res-rows').innerHTML = rowsHTML();
      }
      paintRows();

      if (!faultOut) {
        var ok = h('<button type="button" class="btn btn-ok">' + Icons.get('check') + '<span>درست</span></button>');
        ok.addEventListener('click', function () {
          engine.dialogRight();
          beep('correct');
          vibrate(20);
          paintRows();
          ok.disabled = true;
          no.disabled = true;
          toast('پاداش زمان اضافه شد: ' + fa(Math.floor(t.timeLeft / 30)));
        });
        var no = h('<button type="button" class="btn btn-bad">' + Icons.get('x') + '<span>غلط</span></button>');
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
      var body = '<div style="max-height:40vh;overflow:auto">';
      t.speedList.forEach(function (x) {
        body += '<div class="round-line" style="--team:' + (x.right ? 'var(--green)' : 'var(--rose)') + '">' +
          '<span class="rl-dot" style="background:' + (x.right ? 'var(--green)' : 'var(--rose)') + '"></span>' +
          '<span class="rl-name" style="font-size:var(--fs-sm)">' + esc(x.word.text) + '</span>' +
          '<span class="rl-delta" style="color:' + (x.right ? 'var(--green)' : 'var(--rose)') + '">' + (x.right ? '+' + fa(x.word.score) : '—') + '</span>' +
          '</div>';
      });
      body += '</div>' +
        '<div class="round-line" style="border-top:3px solid var(--line)">' +
        '<span class="rl-name" style="font-family:var(--font-display)">جمع کل</span>' +
        '<span class="rl-total" style="font-family:var(--font-display);font-size:30px;color:var(--amber)">' + fa(sum) + '</span>' +
        '</div>';

      modal({
        title: 'نتیجه سرعتی',
        icon: 'bolt',
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

  /* ----- بوم (BoomPlayFragment) ----- */

  function renderBoom() {
    var b = engine.boom;
    var el = h('<div></div>');
    var team = engine.team(b.active);

    var head = h(
      '<div class="play-head" style="justify-content:center">' +
      '<span class="turn-pill" id="boom-player" style="--team:' + TEAM_COLORS[team ? team.color : 0].v + ';border-color:' + TEAM_COLORS[team ? team.color : 0].v + '">' +
      Icons.get('users') + ' ' + esc(team ? team.name : '') + '</span>' +
      '<span class="round-pill">دور ' + fa(engine.roundNumber()) + ' از ' + fa(engine.rounds) + '</span>' +
      '</div>'
    );

    var timerWrap = h(
      '<div class="timer-num" id="boom-num" style="text-align:center;font-size:clamp(48px,15vw,72px);font-family:var(--font-display);margin-top:var(--s-2)">' + mmss(b.timeLeft) + '</div>'
    );

    var wordCard = h(
      '<div class="clay word-card" id="word-card">' +
      '<div class="w-text" id="w-text">کلمه مخفی است</div>' +
      '</div>'
    );

    var bigBtn = h('<button type="button" class="btn btn-primary btn-lg btn-block" id="big-btn" style="margin-top:var(--s-3);min-height:84px;font-size:clamp(19px,5vw,24px)">' + Icons.get('eye') + '<span>نمایش کلمه</span></button>');

    var controls = h('<div class="controls" id="controls"></div>');

    el.appendChild(head);
    el.appendChild(timerWrap);
    el.appendChild(wordCard);
    el.appendChild(bigBtn);
    el.appendChild(controls);

    function paint() {
      var holder = engine.team(b.state === 1 ? b.player : b.active);
      var pill = el.querySelector('#boom-player');
      pill.style.setProperty('--team', TEAM_COLORS[holder.color].v);
      pill.style.borderColor = TEAM_COLORS[holder.color].v;
      pill.innerHTML = Icons.get('users') + ' ' + esc(holder.name);

      var txt = el.querySelector('#w-text');
      if (b.state === 1) {
        txt.textContent = 'کلمه مخفی است';
        txt.classList.remove('len-m', 'len-l', 'len-xl');
      } else {
        txt.textContent = b.word;
        var len = b.word.length;
        txt.classList.toggle('len-m', len > 14 && len <= 30);
        txt.classList.toggle('len-l', len > 30 && len <= 70);
        txt.classList.toggle('len-xl', len > 70);
      }

      var num = el.querySelector('#boom-num');
      num.textContent = mmss(b.state === 1 ? engine.moreTime : b.timeLeft);
      num.style.color = (b.running && b.timeLeft <= 2) ? 'var(--rose)' : '';

      if (b.state === 1) { bigBtn.innerHTML = Icons.get('eye') + '<span>نمایش کلمه</span>'; bigBtn.className = 'btn btn-primary btn-lg btn-block'; }
      else if (b.state === 2) { bigBtn.innerHTML = Icons.get('play2') + '<span>شروع ' + fa(engine.moreTime) + ' ثانیه‌ای</span>'; bigBtn.className = 'btn btn-skip btn-lg btn-block'; }
      else { bigBtn.innerHTML = Icons.get('pause') + '<span>در حال اجرا</span>'; bigBtn.className = 'btn btn-ghost btn-lg btn-block'; bigBtn.disabled = true; }

      controls.innerHTML = '';
      if (b.state === 3) {
        var ok = h('<button type="button" class="btn btn-ok">' + Icons.get('check') + '<span>درست</span></button>');
        ok.addEventListener('click', function () {
          stopTimer();
          var gain = engine.boomTrue();
          beep('correct');
          vibrate(20);
          if (gain) toast('+' + fa(gain) + ' امتیاز');
          afterBoom();
        });
        var no = h('<button type="button" class="btn btn-bad">' + Icons.get('x') + '<span>غلط</span></button>');
        no.addEventListener('click', function () {
          stopTimer();
          engine.boomFalse();
          beep('wrong');
          vibrate(30);
          afterBoom();
        });
        controls.appendChild(ok);
        controls.appendChild(no);
      }
    }

    function afterBoom() {
      paint();
      var next = engine.boomNext();
      if (next === 'end') { go('rank'); return; }
      /* آماده‌ی کلمه بعدی — دست بعدی */
      beep('click');
      paint();
      toast('نوبت ' + engine.team(b.player).name);
    }

    bigBtn.addEventListener('click', function () {
      if (b.state === 1) {
        engine.boomReveal();
        beep('click');
        vibrate(12);
        paint();
      } else if (b.state === 2) {
        engine.boomRun();
        startTick();
        beep('start');
        vibrate(20);
        paint();
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
          afterBoom();
        }
      }, 1000);
    }

    render._cleanup = function () { stopTimer(); };
    paint();
    return el;
  }

  /* ----- رتبه‌بندی (پایان بازی) ----- */

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
        date: Date.now()
      });
    }

    var el = h('<div></div>');
    var crown = h('<div class="clay winner-card" id="winner-card"></div>');
    crown.appendChild(h('<div class="w-crown">' + Icons.get(isTie ? 'heart' : 'crown') + '</div>'));
    crown.appendChild(h('<h1>' + (isTie ? 'مساوی شد!' : 'برنده') + '</h1>'));
    crown.appendChild(h('<div class="w-team">' + esc(isTie ? 'گروه‌ها مساوی‌اند' : winner.name) + '</div>'));

    var medals = ['🥇', '🥈', '🥉'];
    var sg = h('<div style="margin-top:var(--s-4)"></div>');
    rank.forEach(function (t, i) {
      sg.appendChild(h(
        '<div class="round-line" style="--team:' + TEAM_COLORS[t.color].v + '">' +
        '<span style="width:28px;text-align:center;font-size:20px">' + (medals[i] || fa(i + 1)) + '</span>' +
        '<span class="rl-dot" style="background:' + TEAM_COLORS[t.color].v + '"></span>' +
        '<span class="rl-name">' + esc(t.name) + '</span>' +
        '<span class="rl-total" style="font-family:var(--font-display);font-size:26px;color:var(--amber)">' + fa(t.score) + '</span>' +
        '</div>'
      ));
    });
    crown.appendChild(sg);
    el.appendChild(crown);

    var actions = h('<div class="bento" style="margin-top:var(--s-4)"></div>');
    var shareBtn = h('<button type="button" class="clay pressable mode-card span-3" style="--glow:linear-gradient(150deg,#34D399,#065F46)">' +
      '<span class="m-icon">' + Icons.get('heart') + '</span><h3>اشتراک نتیجه</h3><p>متن نتیجه بازی</p></button>');
    shareBtn.addEventListener('click', function () { shareResult(); });
    var again = h('<button type="button" class="clay pressable mode-card span-3" style="--glow:linear-gradient(150deg,#7C3AED,#4C1D95)">' +
      '<span class="m-icon">' + Icons.get('refresh') + '</span><h3>بازی دوباره</h3><p>با همین تنظیمات</p></button>');
    again.addEventListener('click', function () { beep('click'); beginGame(); });
    var home = h('<button type="button" class="clay pressable mode-card span-3" style="--glow:linear-gradient(150deg,#22D3EE,#0E7490)">' +
      '<span class="m-icon">' + Icons.get('home') + '</span><h3>صفحه اصلی</h3><p>انتخاب حالت بازی</p></button>');
    home.addEventListener('click', function () { beep('click'); engine = null; go('home'); });
    actions.appendChild(shareBtn);
    actions.appendChild(again);
    actions.appendChild(home);
    el.appendChild(actions);

    if (isTie) Confetti.burst(200);
    else { Confetti.burst(240); beep('win'); }

    render._cleanup = function () { stopTimer(); };
    return el;
  }

  function shareResult() {
    var text = engine.shareText();
    if (navigator.share) {
      navigator.share({ title: 'نتیجه ادابازی', text: text }).catch(function () { });
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        toast('متن نتیجه کپی شد');
      }, function () { toast('کپی ناموفق بود'); });
    } else {
      toast('اشتراک در این مرورگر پشتیبانی نمی‌شود');
    }
  }

  /* ----- تاریخچه ----- */

  function renderHistory() {
    var el = h('<div></div>');
    el.appendChild(h('<section class="clay hero" style="padding:var(--s-5)"><h1 style="font-size:var(--fs-h1)">تاریخچه بازی‌ها</h1><p>' +
      fa(Store.stats.games) + ' بازی انجام شده — ' + fa(Store.stats.words) + ' کلمه.</p></section>'));

    var list = Store.history;
    if (!list.length) {
      el.appendChild(h('<div class="empty clay" style="margin-top:var(--s-4)">' + Icons.get('history') +
        '<div>هنوز بازی‌ای انجام نداده‌ای.</div></div>'));
    } else {
      var box = h('<div style="margin-top:var(--s-4)"></div>');
      list.forEach(function (r) {
        var d = new Date(r.date);
        var dateStr = d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        var item = h(
          '<div class="clay hist-item">' +
          '<span class="h-ico" style="--glow:#7C3AED">' + Icons.get(r.mode === 'boom' ? 'bolt' : 'book') + '</span>' +
          '<span class="h-main"><strong>' + esc(r.winner) + ' — ' + (r.mode === 'boom' ? 'بوم' : 'ادابازی') + '</strong>' +
          '<span>' + dateStr + ' · ' + fa(r.rounds || 0) + ' دور</span></span>' +
          '<span class="h-score">' + fa(r.score || 0) + '</span>' +
          '</div>'
        );
        box.appendChild(item);
      });
      el.appendChild(box);

      var clear = h('<button type="button" class="btn btn-danger btn-block" style="margin-top:var(--s-5)">' + Icons.get('trash') + ' پاک کردن تاریخچه</button>');
      clear.addEventListener('click', function () {
        modal({
          title: 'تاریخچه پاک شود؟',
          body: 'همه رکوردها و آمارها حذف می‌شوند.',
          icon: 'trash',
          actions: [
            { label: 'انصراف', cls: 'btn-ghost' },
            {
              label: 'پاک کن', cls: 'btn-danger', onClick: function () {
                Store.clearHistory(); toast('تاریخچه پاک شد'); go('history');
              }
            }
          ]
        });
      });
      el.appendChild(clear);
    }
    return el;
  }

  /* ----- تنظیمات ----- */

  function renderSettings() {
    var st = Store.settings;
    var el = h('<div></div>');
    el.appendChild(h('<section class="clay hero" style="padding:var(--s-5)"><h1 style="font-size:var(--fs-h1)">تنظیمات</h1>' +
      '<p>همه امکانات رایگان است؛ هیچ قفل یا خریدی وجود ندارد.</p></section>'));

    var box = h('<div style="margin-top:var(--s-4)"></div>');
    box.appendChild(toggleRow('volume', 'صداهای بازی', 'بوق درست/غلط و پایان زمان', st.sound, function (v) {
      Store.setSetting('sound', v); GameAudio.setEnabled(v); if (v) beep('correct');
    }));
    box.appendChild(toggleRow('spark', 'لرزش گوشی', 'بازخورد لمسی هنگام پاسخ', st.haptics, function (v) {
      Store.setSetting('haptics', v); if (v) vibrate(30);
    }));
    el.appendChild(box);

    var about = h('<div style="margin-top:var(--s-5)"></div>');
    var resetBtn = h('<button type="button" class="btn btn-ghost btn-block">' + Icons.get('refresh') + ' بازنشانی کامل تنظیمات</button>');
    resetBtn.addEventListener('click', function () {
      modal({
        title: 'بازنشانی؟', body: 'تنظیمات، آمار و تاریخچه به حالت اول برمی‌گردند.', icon: 'refresh',
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

    var aboutBtn = h('<button type="button" class="btn btn-ghost btn-block" style="margin-top:var(--s-3)">' + Icons.get('info') + ' درباره ادابازی</button>');
    aboutBtn.addEventListener('click', function () { go('about'); });
    about.appendChild(aboutBtn);
    el.appendChild(about);

    el.appendChild(h('<p class="foot">داده‌ها فقط روی دستگاه خودت (localStorage) ذخیره می‌شوند.<br>هیچ سروری، هیچ تبلیغی، هیچ پرداختی.</p>'));
    return el;
  }

  function toggleRow(icon, title, sub, val, onChange) {
    var row = h(
      '<div class="row">' +
      '<span class="r-icon" style="--glow:#7C3AED">' + Icons.get(icon) + '</span>' +
      '<div class="r-text"><strong>' + esc(title) + '</strong><span>' + esc(sub) + '</span></div>' +
      '<button type="button" class="switch" role="switch" aria-checked="' + !!val + '" aria-label="' + esc(title) + '"></button>' +
      '</div>'
    );
    var sw = row.querySelector('.switch');
    var on = !!val;
    sw.addEventListener('click', function () {
      on = !on;
      sw.setAttribute('aria-checked', String(on));
      onChange(on);
      beep('click');
    });
    return row;
  }

  /* ----- درباره ----- */

  function renderAbout() {
    var el = h('<div></div>');
    el.appendChild(h(
      '<section class="clay hero" style="padding:var(--s-5)">' +
      '<h1 style="font-size:var(--fs-h1)">درباره ادابازی</h1>' +
      '<p>نسخه وب بازی گروهی پانتومیم و حدس کلمه — با همان قوانین اپ اصلی: گروه‌ها، دورها، دسته‌ها و امتیازدهی.</p>' +
      '</section>'
    ));

    var list = h('<div style="margin-top:var(--s-4)"></div>');
    [
      ['shield', 'رایگان و بدون قفل', 'هیچ دسته، کلمه یا امکانی قفل نیست. هیچ پرداختی در کار نیست.', '#34D399'],
      ['heart', 'بدون جمع‌آوری داده', 'هیچ اطلاعاتی از دستگاهت به بیرون ارسال نمی‌شود. همه چیز محلی است.', '#F43F5E'],
      ['book', 'منطق اپ اصلی', 'ساخت نوبت‌ها، زمان ثابت هر دسته، تعویض کلمه، خطاها و پاداش زمان — دقیقاً مثل نسخه اندروید.', '#7C3AED'],
      ['grid', 'چهار دسته بازی', 'سرعتی، ضرب‌المثل، دسته‌های کلمه و ترانه + حالت ویژه‌ی بوم.', '#22D3EE']
    ].forEach(function (r) {
      list.appendChild(h(
        '<div class="row"><span class="r-icon" style="--glow:' + r[3] + '">' + Icons.get(r[0]) + '</span>' +
        '<div class="r-text"><strong>' + r[1] + '</strong><span>' + r[2] + '</span></div></div>'
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
        '<div class="empty clay">' + Icons.get('info') +
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
