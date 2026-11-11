/* اپ اصلی — روتر، رندر صفحات، کنترل بازی */
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

  var MODES = {
    adabazi: {
      title: 'ادبیات',
      desc: 'کلمه را بازی کن، تیمت امتیاز بگیرد. ۱۶ هزار کلمه در ۱۸ دسته.',
      icon: 'book',
      glow: 'linear-gradient(150deg, #7C3AED, #4C1D95)'
    },
    boom: {
      title: 'بوم',
      desc: 'هر کلمه یک چالش سریع: «اسم پسر با الف»، «غذا با ب»…',
      icon: 'bolt',
      glow: 'linear-gradient(150deg, #F43F5E, #9F1239)'
    },
    songs: {
      title: 'ترانه',
      desc: 'متن ترانه را بخوان یا ادا کن؛ خواننده و عنوان را حدس بزنند.',
      icon: 'music',
      glow: 'linear-gradient(150deg, #22D3EE, #0E7490)'
    }
  };

  var TEAM_COLORS = [
    { v: '#7C3AED', n: 'بنفش' }, { v: '#F43F5E', n: 'قرمز' }, { v: '#22D3EE', n: 'آبی' },
    { v: '#FBBF24', n: 'زرد' }, { v: '#34D399', n: 'سبز' }, { v: '#FF4FA3', n: 'صورتی' },
    { v: '#38BDF8', n: 'آسمانی' }, { v: '#A3E635', n: 'lime' }
  ];

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
    var scrim = h(
      '<div class="scrim" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || 'پنجره') + '">' +
      '<div class="modal clay">' +
      (opts.icon ? '<div class="winner-card" style="padding:0 0 8px"><div class="w-crown" style="width:64px;height:64px;border-radius:22px">' + Icons.get(opts.icon) + '</div></div>' : '') +
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
    btnSettings.hidden = (route === 'play' || route === 'setup');
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
      setup: renderSetup,
      play: renderPlay,
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
    { icon: 'users', title: 'گروه‌ها را بسازید', desc: 'نام، رنگ و ترتیب تیم‌ها را مشخص کنید؛ از ۲ تا ۶ تیم می‌توانند در یک بازی شرکت کنند.' },
    { icon: 'spark', title: 'حالت بازی را انتخاب کنید', desc: 'سرعت، ضرب‌المثل، کلمات دسته‌بندی‌شده یا ترانه؛ هر حالت قوانین و امتیازدهی مستقلی دارد.' },
    { icon: 'book', title: 'کلمه بگیرید و اجرا کنید', desc: 'کلمه مخفی است و با «شروع تایمر» اجرا شروع می‌شود؛ در پایان نوبت نتیجه ثبت می‌شود.' }
  ];

  function renderHome() {
    var s = Store.stats;
    var el = h('<div></div>');

    el.appendChild(h(
      '<section class="clay hero">' +
      '<div class="hero-tags"><span class="tag">رایگان</span><span class="tag">بدون تبلیغات</span><span class="tag">بدون خرید درون‌برنامه‌ای</span><span class="tag">۱۶,۳۰۵ کلمه</span></div>' +
      '<h1>بازی گروهی<br>پانتومیم <span class="grad-text">و حدس کلمه</span></h1>' +
      '<p>یک تیم کلمه می‌خواند و اجرا می‌کند؛ تیم دیگر حدس می‌زند. دورهای کوتاه، امتیازهای درشت، ذهنیت جمعی و بدون تبلیغات.</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn btn-primary btn-lg" id="cta-play">' + Icons.get('play') + ' شروع بازی</button>' +
      '<button type="button" class="btn btn-ghost btn-lg" id="cta-how">' + Icons.get('dice') + ' چیدمان بازی</button>' +
      '</div>' +
      '<div class="hero-stats">' +
      '<div class="hs-item"><strong>۱۶,۳۰۵</strong><span>کلمه ادبیات</span></div>' +
      '<div class="hs-item"><strong>۱,۰۲۹</strong><span>چالش بوم</span></div>' +
      '<div class="hs-item"><strong>۵۰</strong><span>ترانه</span></div>' +
      '<div class="hs-item"><strong>' + s.games.toLocaleString('fa-IR') + '</strong><span>بازی انجام‌شده</span></div>' +
      '</div>' +
      '</section>'
    ));

    var bento = h('<div class="bento" style="margin-top:var(--s-4)"></div>');

    Object.keys(MODES).forEach(function (key) {
      var m = MODES[key];
      var count = data.totals[key];
      var card = h(
        '<button type="button" class="clay pressable mode-card span-2" data-mode="' + key + '" style="--glow:' + m.glow + '">' +
        '<span class="m-icon">' + Icons.get(m.icon) + '</span>' +
        '<h3>' + m.title + '</h3>' +
        '<p>' + m.desc + '</p>' +
        '<span class="m-count">' + count.toLocaleString('fa-IR') + ' محتوا</span>' +
        '</button>'
      );
      card.addEventListener('click', function () { beep('click'); pendingMode = key; go('setup'); });
      bento.appendChild(card);
    });

    el.appendChild(bento);

    var howWrap = h('<div class="bento" style="margin-top:var(--s-4)"></div>');
    var steps = h('<div class="how-grid"></div>');
    HOW_STEPS.forEach(function (st, i) {
      var card = h(
        '<button type="button" class="clay pressable how-card" data-how="' + i + '">' +
        '<span class="h-top"><span class="h-num">' + (i + 1) + '</span><span class="h-icon">' + Icons.get(st.icon) + '</span></span>' +
        '<h3>' + st.title + '</h3>' +
        '<p>' + st.desc + '</p>' +
        '</button>'
      );
      steps.appendChild(card);
    });
    howWrap.appendChild(steps);
    el.appendChild(howWrap);

    var stats = h('<div class="bento" style="margin-top:var(--s-4)"></div>');
    stats.appendChild(mini('chart', 'بازی‌ها', s.games.toLocaleString('fa-IR'), 'تعداد کل بازی‌ها', '#7C3AED', 'stats'));
    stats.appendChild(mini('target', 'کلمه‌ها', s.words.toLocaleString('fa-IR'), 'کلمه بازی‌شده', '#F43F5E', 'stats'));
    stats.appendChild(mini('history', 'تاریخچه', Store.history.length.toLocaleString('fa-IR'), 'بازی‌های اخیر', '#22D3EE', 'history'));
    el.appendChild(stats);

    el.appendChild(h(
      '<div class="bento" style="margin-top:var(--s-4)">' +
      '<button type="button" class="clay pressable mini-card span-3" id="open-settings" style="--glow:#34D399">' +
      '<span class="mc-icon">' + Icons.get('settings') + '</span>' +
      '<strong>تنظیمات بازی</strong><span>زمان، تعداد دور، صدا</span></button>' +
      '<button type="button" class="clay pressable mini-card span-3" id="open-about" style="--glow:#FBBF24">' +
      '<span class="mc-icon">' + Icons.get('info') + '</span>' +
      '<strong>درباره و حریم خصوصی</strong><span>بدون جمع‌آوری داده</span></button>' +
      '</div>'
    ));

    el.appendChild(h(
      '<p class="foot">ادابازی نسخه وب — کاملاً رایگان، بدون تبلیغات و بدون پرداخت درون‌برنامه‌ای.<br>' +
      'ساخته‌شده بر پایه محتوای استخراج‌شده از بازی ادبیات.</p>'
    ));

    el.querySelector('#cta-play').addEventListener('click', function () { beep('click'); pendingMode = 'adabazi'; go('setup'); });
    el.querySelector('#cta-how').addEventListener('click', function () { beep('click'); go('setup'); });
    el.querySelectorAll('[data-how]').forEach(function (b) {
      b.addEventListener('click', function () { beep('click'); go('setup'); });
    });
    el.querySelector('#open-settings').addEventListener('click', function () { beep('click'); go('settings'); });
    el.querySelector('#open-about').addEventListener('click', function () { beep('click'); go('about'); });
    el.querySelectorAll('[data-stats], [data-history]').forEach(function (b) {
      b.addEventListener('click', function () { beep('click'); go('history'); });
    });

    return el;
  }

  function mini(icon, title, value, sub, glow, id) {
    var b = h(
      '<button type="button" class="clay pressable mini-card span-2" style="--glow:' + glow + '">' +
      '<span class="mc-icon">' + Icons.get(icon) + '</span>' +
      '<strong>' + value + '</strong><span>' + title + ' — ' + sub + '</span>' +
      '</button>'
    );
    if (id) b.setAttribute('data-' + id, '');
    return b;
  }

  /* ----- تنظیمات بازی ----- */

  var pendingMode = 'adabazi';
  var setupDraft = null;

  function renderSetup() {
    var st = Store.settings;
    if (!setupDraft || setupDraft.mode !== pendingMode) {
      setupDraft = {
        mode: pendingMode,
        rounds: st.rounds,
        roundTime: st.roundTime,
        wordsPerTurn: st.wordsPerTurn,
        timeReward: !!st.timeReward,
        cats: data.usableCategories.map(function (c) { return c.cid; }),
        teamNames: st.teamNames.slice(),
        teamColors: st.teamColors.slice()
      };
    }
    var d = setupDraft;
    var el = h('<div></div>');
    var m = MODES[d.mode];

    el.appendChild(h(
      '<section class="clay hero" style="padding:var(--s-5)">' +
      '<div class="hero-tags"><span class="tag">' + m.title + '</span></div>' +
      '<h1 style="font-size:var(--fs-h1)">تنظیمات بازی</h1>' +
      '<p>' + m.desc + '</p>' +
      '</section>'
    ));

    /* تیم‌ها */
    var teamsBox = h('<div style="margin-top:var(--s-4)"><div class="section-title">' + Icons.get('users') + ' تیم‌ها</div></div>');
    var teamList = h('<div id="team-list"></div>');

    function paintTeams() {
      teamList.innerHTML = '';
      d.teamNames.forEach(function (name, i) {
        var row = h(
          '<div class="team-row team-' + (d.teamColors[i] || 0) + '">' +
          '<span class="team-dot" style="--team:' + TEAM_COLORS[d.teamColors[i] || 0].v + '"></span>' +
          '<input type="text" value="' + esc(name) + '" maxlength="14" aria-label="نام تیم ' + (i + 1) + '">' +
          '<div class="swatches" role="group" aria-label="رنگ تیم"></div>' +
          (d.teamNames.length > 2 ? '<button type="button" class="icon-btn" data-rm aria-label="حذف تیم">' + Icons.get('trash') + '</button>' : '') +
          '</div>'
        );
        var sw = row.querySelector('.swatches');
        TEAM_COLORS.forEach(function (c, ci) {
          var s = h('<button type="button" class="swatch" style="--c:' + c.v + '" aria-label="' + c.n + '" aria-pressed="' + (ci === (d.teamColors[i] || 0)) + '"></button>');
          s.addEventListener('click', function () {
            d.teamColors[i] = ci;
            paintTeams();
            beep('click');
          });
          sw.appendChild(s);
        });
        row.querySelector('input').addEventListener('input', function (e) { d.teamNames[i] = e.target.value; });
        var rm = row.querySelector('[data-rm]');
        if (rm) rm.addEventListener('click', function () {
          d.teamNames.splice(i, 1);
          d.teamColors.splice(i, 1);
          paintTeams();
        });
        teamList.appendChild(row);
      });
    }
    paintTeams();

    var addBtn = h('<button type="button" class="btn btn-ghost btn-block" style="margin-top:var(--s-3)">' + Icons.get('plus') + ' افزودن تیم</button>');
    addBtn.addEventListener('click', function () {
      if (d.teamNames.length >= 6) { toast('حداکثر ۶ تیم'); return; }
      var used = d.teamColors.slice();
      var next = 0;
      for (var i = 0; i < TEAM_COLORS.length; i++) { if (used.indexOf(i) < 0) { next = i; break; } }
      d.teamNames.push('تیم ' + (d.teamNames.length + 1));
      d.teamColors.push(next);
      paintTeams();
      beep('click');
    });
    teamsBox.appendChild(teamList);
    teamsBox.appendChild(addBtn);
    el.appendChild(teamsBox);

    /* قوانین */
    var rules = h('<div style="margin-top:var(--s-5)"><div class="section-title">' + Icons.get('timer') + ' قوانین بازی</div></div>');
    rules.appendChild(stepper('تعداد دور', d.rounds, 1, 10, function (v) { d.rounds = v; }, 'round'));
    rules.appendChild(stepper('زمان هر نوبت (ثانیه)', d.roundTime, 15, 180, function (v) { d.roundTime = v; }, 'time'));
    rules.appendChild(stepper('کلمه در هر نوبت', d.wordsPerTurn, 1, 12, function (v) { d.wordsPerTurn = v; }, 'words'));
    el.appendChild(rules);

    /* دسته‌ها (فقط ادبیات) */
    if (d.mode === 'adabazi') {
      var catBox = h('<div style="margin-top:var(--s-5)"><div class="section-title">' + Icons.get('grid') + ' دسته‌ها</div>' +
        '<div class="chip-row" id="cat-row"></div></div>');
      var row = catBox.querySelector('#cat-row');

      var allChip = h('<button type="button" class="chip is-on">' + Icons.get('layers') + ' همه</button>');
      allChip.addEventListener('click', function () {
        d.cats = data.usableCategories.map(function (c) { return c.cid; });
        paintCats();
        beep('click');
      });
      row.appendChild(allChip);

      data.usableCategories.forEach(function (c) {
        var chip = h('<button type="button" class="chip">' + esc(c.fa) + ' <span style="opacity:.7">' + data.countFor(c).toLocaleString('fa-IR') + '</span></button>');
        chip.dataset.cid = c.cid;
        chip.addEventListener('click', function () {
          var idx = d.cats.indexOf(c.cid);
          if (idx >= 0) d.cats.splice(idx, 1); else d.cats.push(c.cid);
          if (!d.cats.length) d.cats.push(c.cid);
          paintCats();
          beep('click');
        });
        row.appendChild(chip);
      });

      function paintCats() {
        var all = d.cats.length === data.usableCategories.length;
        allChip.classList.toggle('is-on', all);
        row.querySelectorAll('[data-cid]').forEach(function (chip) {
          chip.classList.toggle('is-on', d.cats.indexOf(Number(chip.dataset.cid)) >= 0);
        });
      }
      paintCats();
      el.appendChild(catBox);
    }

    /* شروع */
    var start = h('<button type="button" class="btn btn-primary btn-lg btn-block" style="margin-top:var(--s-6)">' + Icons.get('play') + ' شروع بازی</button>');
    start.addEventListener('click', function () { beginGame(); });
    el.appendChild(start);

    return el;
  }

  function stepper(label, val, min, max, onChange, key) {
    var wrap = h(
      '<div class="row">' +
      '<div class="r-text"><strong>' + esc(label) + '</strong></div>' +
      '<div class="stepper">' +
      '<button type="button" class="icon-btn" data-dec aria-label="کاهش">' + Icons.get('minus') + '</button>' +
      '<span class="step-val" data-val>' + val.toLocaleString('fa-IR') + '</span>' +
      '<button type="button" class="icon-btn" data-inc aria-label="افزایش">' + Icons.get('plus') + '</button>' +
      '</div></div>'
    );
    var v = val;
    function paint() { wrap.querySelector('[data-val]').textContent = v.toLocaleString('fa-IR'); }
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
    var d = setupDraft;
    if (d.teamNames.filter(function (n) { return n.trim(); }).length < 2) {
      toast('حداقل ۲ تیم لازم است');
      return;
    }
    Store.setSetting('rounds', d.rounds);
    Store.setSetting('roundTime', d.roundTime);
    Store.setSetting('wordsPerTurn', d.wordsPerTurn);
    Store.setTeams(d.teamNames.map(function (n, i) { return n.trim() || ('تیم ' + (i + 1)); }), d.teamColors);

    engine = new GameEngine(data, {
      mode: d.mode,
      categories: d.cats,
      teams: d.teamNames.map(function (n, i) { return { name: n.trim() || ('تیم ' + (i + 1)), color: d.teamColors[i] }; }),
      rounds: d.rounds,
      roundTime: d.roundTime,
      wordsPerTurn: d.wordsPerTurn,
      timeReward: !!d.timeReward
    });

    if (!engine.pool.length) { toast('محتوایی برای این انتخاب نیست'); return; }

    beep('start');
    go('play');
  }

  /* ----- صفحه بازی ----- */

  function renderPlay() {
    var el = h('<div></div>');
    var wordCard = h(
      '<div class="clay word-card" id="word-card">' +
      '<div class="w-meta"></div>' +
      '<div class="w-text">…</div>' +
      '<div class="w-sub"></div>' +
      '</div>'
    );

    var head = h('<div class="play-head"></div>');
    var scoreboard = h('<div class="scoreboard" id="scoreboard"></div>');

    var timerWrap = h(
      '<div class="timer-wrap" id="timer-wrap">' +
      '<svg class="timer-ring" viewBox="0 0 200 200" aria-hidden="true">' +
      '<defs><linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#A78BFA"/><stop offset="55%" stop-color="#F43F5E"/><stop offset="100%" stop-color="#FBBF24"/>' +
      '</linearGradient></defs>' +
      '<circle class="track" cx="100" cy="100" r="86"/>' +
      '<circle class="bar" id="timer-bar" cx="100" cy="100" r="86"/>' +
      '</svg>' +
      '<div class="timer-num" id="timer-num">0</div>' +
      '</div>'
    );

    var controls = h(
      '<div class="controls">' +
      '<button type="button" class="btn btn-primary" id="c-show">' + Icons.get('eye') + '<span>نمایش کلمه</span></button>' +
      '<button type="button" class="btn btn-primary" id="c-start">' + Icons.get('play2') + '<span>شروع تایمر</span></button>' +
      '<button type="button" class="btn btn-ok" id="c-ok">' + Icons.get('check') + '<span>درست</span></button>' +
      '<button type="button" class="btn btn-bad" id="c-bad">' + Icons.get('x') + '<span>غلط</span></button>' +
      '<button type="button" class="btn btn-skip" id="c-skip">' + Icons.get('skip') + '<span>رد</span></button>' +
      '<button type="button" class="btn btn-skip" id="c-swap">' + Icons.get('swap') + '<span>تعویض کلمه</span></button>' +
      '<button type="button" class="btn btn-ghost btn-wide" id="c-undo">' + Icons.get('undo') + '<span>بازگشت (لغو آخرین کلمه)</span></button>' +
      '<button type="button" class="btn btn-ghost btn-wide" id="c-pause">' + Icons.get('pause') + '<span>مکث</span></button>' +
      '</div>'
    );

    el.appendChild(head);
    el.appendChild(scoreboard);
    el.appendChild(wordCard);
    el.appendChild(timerWrap);
    el.appendChild(controls);

    function paintHead() {
      var modeLabel = engine.mode === 'adabazi' ? 'ادبیات' : engine.mode === 'boom' ? 'بوم' : 'ترانه';
      head.innerHTML =
        '<span class="round-pill">دور ' + engine.round.toLocaleString('fa-IR') + ' از ' + engine.opts.rounds.toLocaleString('fa-IR') + '</span>' +
        '<span class="turn-pill" id="turn-pill">' + Icons.get('users') + ' نوبت: ' + esc(engine.team().name) + '</span>' +
        '<span class="turn-pill">' + modeLabel + '</span>';
      var tp = head.querySelector('#turn-pill');
      tp.classList.add('team-' + (engine.team().color || 0));
      tp.style.setProperty('--team', TEAM_COLORS[engine.team().color || 0].v);
      tp.style.borderColor = TEAM_COLORS[engine.team().color || 0].v;
    }

    function paintScore() {
      scoreboard.innerHTML = '';
      engine.teams.forEach(function (t, i) {
        var card = h(
          '<div class="score-card team-' + (t.color || 0) + (i === engine.turnIndex && !engine.over ? ' is-turn' : '') + '">' +
          '<span class="sc-name">' + esc(t.name) + '</span>' +
          '<span class="sc-score">' + t.score.toLocaleString('fa-IR') + '</span>' +
          '</div>'
        );
        card.style.setProperty('--team', TEAM_COLORS[t.color || 0].v);
        scoreboard.appendChild(card);
      });
    }

    function paintWord() {
      var w = engine.currentWord();
      var meta = wordCard.querySelector('.w-meta');
      var txt = wordCard.querySelector('.w-text');
      var sub = wordCard.querySelector('.w-sub');

      if (!w) { txt.textContent = 'تمام شد'; sub.textContent = ''; meta.innerHTML = ''; return; }

      meta.innerHTML = '';
      if (engine.mode === 'adabazi') {
        meta.appendChild(h('<span class="score-badge">' + w.score.toLocaleString('fa-IR') + ' امتیاز</span>'));
      } else if (engine.mode === 'songs') {
        meta.appendChild(h('<span class="score-badge">' + (w.score || 5).toLocaleString('fa-IR') + ' امتیاز</span>'));
      } else {
        meta.appendChild(h('<span class="score-badge">۳ امتیاز</span>'));
      }
      if (engine.mode === 'adabazi') {
        var cat = data.usableCategories.filter(function (c) { return (data.adabazi[String(c.cid)] || []).some(function (x) { return x[0] === w.text && x[1] === w.score; }); })[0];
        if (cat) meta.appendChild(h('<span class="tag">' + esc(cat.fa) + '</span>'));
      }
      if (engine.phase === 'setup') {
        txt.textContent = 'کلمه مخفی است';
        txt.classList.remove('len-m', 'len-l', 'len-xl');
        txt.style.animation = 'none';
        sub.textContent = '';
        return;
      }
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

    function paintTimer() {
      var total = engine.opts.roundTime;
      var left = Math.max(0, engine.timeLeft);
      var bar = el.querySelector('#timer-bar');
      var num = el.querySelector('#timer-num');
      var wrap = el.querySelector('#timer-wrap');
      if (!bar) return;
      var C = 2 * Math.PI * 86;
      bar.style.strokeDasharray = C;
      bar.style.strokeDashoffset = C * (1 - left / total);
      if (left !== lastTickShown) {
        num.textContent = left.toLocaleString('fa-IR');
        lastTickShown = left;
      }
      wrap.classList.toggle('is-urgent', left <= 10);
    }

    function afterAction() {
      paintScore();
      paintHead();
      if (engine.over) {
        stopTimer();
        finishTurn();
      } else {
        paintWord();
      }
    }

    function answer(kind) {
      if (!engine || engine.over) return;
      if (engine.phase !== 'show' && engine.phase !== 'running') return;
      var rec = engine.answer(kind);
      if (!rec) return;
      if (kind === 'correct') { beep('correct'); vibrate(14); }
      else if (kind === 'wrong') { beep('wrong'); vibrate([18, 40, 18]); }
      else { beep('skip'); vibrate(10); }
      afterAction();
    }

    el.querySelector('#c-show').addEventListener('click', function () {
      if (engine.phase === 'setup') { engine.show(); afterAction(); var sb = el.querySelector('#c-start'); if (sb) sb.style.display = 'inline-flex'; }
    });
    el.querySelector('#c-start').addEventListener('click', function () {
      if (engine.phase === 'show') { engine.startTimer(); afterAction(); var sb = el.querySelector('#c-start'); if (sb) sb.style.display = 'none'; }
    });
    el.querySelector('#c-ok').addEventListener('click', function () { answer('correct'); });
    el.querySelector('#c-bad').addEventListener('click', function () { answer('wrong'); });
    el.querySelector('#c-skip').addEventListener('click', function () { answer('skip'); });
    el.querySelector('#c-swap').addEventListener('click', function () {
      if (engine.phase === 'show' || engine.phase === 'running') { engine.swapWord(); afterAction(); }
    });

    el.querySelector('#c-undo').addEventListener('click', function () {
      if (engine.undo()) {
        beep('click');
        paintScore(); paintHead(); paintWord();
        if (engine.phase === 'running' && timerId === null) startTimer();
        toast('آخرین کلمه لغو شد');
      } else {
        toast('چیزی برای بازگشت نیست');
      }
    });

    el.querySelector('#c-pause').addEventListener('click', function () {
      if (engine.phase === 'running') {
        engine.pauseTimer();
        toast('بازی متوقف شد');
        this.innerHTML = Icons.get('play2') + '<span>ادامه</span>';
      } else if (engine.phase === 'paused') {
        engine.startTimer();
        toast('ادامه بازی');
        this.innerHTML = Icons.get('pause') + '<span>مکث</span>';
      }
    });

    paintHead();
    paintScore();
    paintWord();
    paintTimer();
    startTimer();
    var startBtn = el.querySelector('#c-start');
    if (startBtn) startBtn.style.display = (engine.phase === 'show') ? 'inline-flex' : 'none';

    function startTimer() {
      stopTimer();
      lastTickShown = null;
      timerId = setInterval(function () {
        if (!engine || engine.phase !== 'running') { stopTimer(); return; }
        var left = engine.tick();
        paintTimer();
        if (left <= 0) {
          stopTimer();
          beep('end');
          vibrate([30, 60, 30]);
          paintScore();
          paintHead();
          if (engine.over) finishTurn();
          return;
        }
        if (left <= 10 && left > 0) beep('tick');
      }, 1000);
    }

    function finishTurn() {
      var summary = {
        team: engine.turnIndex,
        gained: engine.turnScore,
        correct: engine.turnCorrect,
        roundEnd: engine.turnsInRound >= engine.teams.length && !engine.finished,
        end: engine.finished
      };

      if (engine.finished) { endGame(); return; }

      if (summary.roundEnd) {
        showRoundSummary();
      } else {
        // ادامه: نوبت تیم بعدی قبلاً در endTurn جابه‌جا شده
        engine.continueAfterTurn();
        paintHead(); paintScore(); paintWord();
        paintTimer();
        toast('نوبت ' + engine.team().name);
      }
    }

    function showRoundSummary() {
      var body = '<div style="margin-top:8px">';
      engine.teams.forEach(function (t, i) {
        body += '<div class="round-line" style="--team:' + TEAM_COLORS[t.color || 0].v + '">' +
          '<span class="rl-dot"></span>' +
          '<span class="rl-name">' + esc(t.name) + '</span>' +
          '<span class="rl-delta">+' + engine.roundDelta[i].toLocaleString('fa-IR') + '</span>' +
          '<span class="rl-total">' + t.score.toLocaleString('fa-IR') + '</span>' +
          '</div>';
      });
      body += '</div>';

      modal({
        title: 'پایان دور ' + engine.round.toLocaleString('fa-IR'),
        body: body,
        icon: 'flag',
        dismiss: false,
        actions: [{
          label: 'دور بعدی',
          cls: 'btn-primary',
          onClick: function () {
            engine.nextRound();
            beep('start');
            paintHead(); paintScore(); paintWord();
            paintTimer();
          }
        }]
      });
    }

    render._cleanup = function () { stopTimer(); };
    return el;
  }

  /* ----- پایان بازی ----- */

  function endGame() {
    stopTimer();
    beep('win');
    Confetti.burst(200);

    var winner = engine.winner();
    var isTie = engine.isTie();
    var modeTitle = MODES[engine.mode].title;

    Store.addGame({
      mode: engine.mode,
      winner: isTie ? 'مساوی' : winner.name,
      score: engine.teams.reduce(function (m, t) { return Math.max(m, t.score); }, 0),
      words: engine.totalWords,
      rounds: engine.opts.rounds,
      date: Date.now()
    });

    route = 'end';
    setChrome();
    main.innerHTML = '';

    var el = h('<div></div>');
    var crown = h('<div class="clay winner-card" id="winner-card"></div>');

    crown.appendChild(h('<div class="w-crown">' + Icons.get(isTie ? 'heart' : 'crown') + '</div>'));
    crown.appendChild(h('<h1>' + (isTie ? 'مساوی شد!' : 'برنده') + '</h1>'));
    crown.appendChild(h('<div class="w-team">' + esc(isTie ? 'تیم‌ها مساوی‌اند' : winner.name) + '</div>'));

    var sg = h('<div class="stat-grid"></div>');
    engine.teams.forEach(function (t) {
      sg.appendChild(h('<div class="stat-box"><b>' + t.score.toLocaleString('fa-IR') + '</b><span>' + esc(t.name) + '</span></div>'));
    });
    sg.appendChild(h('<div class="stat-box"><b>' + engine.totalWords.toLocaleString('fa-IR') + '</b><span>کلمه درست</span></div>'));
    sg.appendChild(h('<div class="stat-box"><b>' + engine.opts.rounds.toLocaleString('fa-IR') + '</b><span>دور بازی</span></div>'));
    crown.appendChild(sg);
    el.appendChild(crown);

    var actions = h('<div class="bento" style="margin-top:var(--s-4)"></div>');
    var again = h('<button type="button" class="clay pressable mode-card span-3" style="--glow:linear-gradient(150deg,#7C3AED,#4C1D95)">' +
      '<span class="m-icon">' + Icons.get('refresh') + '</span><h3>بازی دوباره</h3><p>با همین تنظیمات</p></button>');
    again.addEventListener('click', function () {
      Confetti.stop();
      beep('click');
      beginGame();
    });
    var home = h('<button type="button" class="clay pressable mode-card span-3" style="--glow:linear-gradient(150deg,#22D3EE,#0E7490)">' +
      '<span class="m-icon">' + Icons.get('home') + '</span><h3>صفحه اصلی</h3><p>انتخاب حالت بازی</p></button>');
    home.addEventListener('click', function () { Confetti.stop(); beep('click'); go('home'); });
    actions.appendChild(again);
    actions.appendChild(home);
    el.appendChild(actions);

    el.appendChild(h('<p class="foot">حالت: ' + modeTitle + ' — ' + engine.opts.rounds.toLocaleString('fa-IR') + ' دور</p>'));

    main.appendChild(el);
    el.classList.add('screen');
  }

  /* ----- تاریخچه ----- */

  function renderHistory() {
    var el = h('<div></div>');
    el.appendChild(h('<section class="clay hero" style="padding:var(--s-5)"><h1 style="font-size:var(--fs-h1)">تاریخچه بازی‌ها</h1><p>' +
      Store.stats.games.toLocaleString('fa-IR') + ' بازی انجام شده — ' + Store.stats.words.toLocaleString('fa-IR') + ' کلمه.</p></section>'));

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
          '<span class="h-ico" style="--glow:' + (MODES[r.mode] ? '#7C3AED' : '#22D3EE') + '">' + Icons.get(MODES[r.mode] ? MODES[r.mode].icon : 'star') + '</span>' +
          '<span class="h-main"><strong>' + esc(r.winner) + ' — ' + (MODES[r.mode] ? MODES[r.mode].title : '') + '</strong>' +
          '<span>' + dateStr + ' · ' + (r.words || 0).toLocaleString('fa-IR') + ' کلمه</span></span>' +
          '<span class="h-score">' + (r.score || 0).toLocaleString('fa-IR') + '</span>' +
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

    box.appendChild(toggleRow('volume', 'صداهای بازی', 'بوق درست/غلط و پایان دور', st.sound, function (v) {
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
      '<p>نسخه وب بازی گروهی پانتومیم و حدس کلمه — بدون تبلیغات، بدون خرید درون‌برنامه‌ای، بدون حساب کاربری.</p>' +
      '</section>'
    ));

    var list = h('<div style="margin-top:var(--s-4)"></div>');
    [
      ['shield', 'رایگان و بدون قفل', 'هیچ دسته، کلمه یا امکانی قفل نیست. هیچ پرداختی در کار نیست.', '#34D399'],
      ['heart', 'بدون جمع‌آوری داده', 'هیچ اطلاعاتی از دستگاهت به بیرون ارسال نمی‌شود. همه چیز محلی است.', '#F43F5E'],
      ['book', '۱۶,۳۰۵ کلمه ادبیات', 'به‌همراه ۱,۰۲۹ چالش بوم و ۵۰ ترانه، در ۱۸ دسته موضوعی.', '#7C3AED'],
      ['grid', 'سه حالت بازی', 'ادبیات (پانتومیم)، بوم (سریع) و ترانه (آوازی).', '#22D3EE']
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
    if (route === 'play') {
      var p = document.getElementById('c-pause');
      var wasRunning = engine.phase === 'running';
      if (wasRunning && p) p.click(); // مکث → تایمر متوقف می‌شود
      modal({
        title: 'خروج از بازی؟',
        body: 'بازی فعلی نیمه‌تمام می‌ماند.',
        icon: 'flag',
        dismiss: false,
        actions: [
          { label: 'ادامه بازی', cls: 'btn-ghost', onClick: function () { if (wasRunning && timerId === null && p) p.click(); } },
          { label: 'خروج', cls: 'btn-danger', onClick: function () { stopTimer(); engine = null; go('home'); } }
        ]
      });
    } else if (route === 'setup' || route === 'end') {
      go('home');
    } else {
      go('home');
    }
  });

  btnSettings.addEventListener('click', function () { beep('click'); go('settings'); });

  document.addEventListener('keydown', function (e) {
    if (route !== 'play' || !engine || engine.over) return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (modalRoot.childElementCount) return;
    if (e.key === 'ArrowRight' || e.key === '1') { e.preventDefault(); answerKey('correct'); }
    else if (e.key === 'ArrowLeft' || e.key === '2') { e.preventDefault(); answerKey('wrong'); }
    else if (e.key === ' ' || e.key === '3') { e.preventDefault(); answerKey('skip'); }
    else if (e.key === 'z' || e.key === 'Z') { var u = document.getElementById('c-undo'); if (u) u.click(); }
    else if (e.key === 'p' || e.key === 'P') { var p = document.getElementById('c-pause'); if (p) p.click(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var last = modalRoot.lastElementChild;
      if (last && last.dataset && last.dataset.dismiss !== '0') closeModal();
    }
  });

  function answerKey(kind) {
    var id = kind === 'correct' ? 'c-ok' : kind === 'wrong' ? 'c-bad' : 'c-skip';
    var b = document.getElementById(id);
    if (b) b.click();
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  /* ---------------- راه‌اندازی ---------------- */

  function boot() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* بی‌صدا */ });
    }

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
