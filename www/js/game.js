/* موتور بازی — بازسازی دقیق منطق اپ اصلی ادابازی (AdabaziPlayFragment / TeamFragment / CategoryFragment / BoomPlayFragment)
 *
 * ساختار:
 *  - ساخت بازی: تعداد گروه‌ها (۲..۶) + تعداد دور (۱..۱۰) + زمان اضافه
 *  - صفحه گروه: چرخش تیم‌ها با Continue؛ شمارنده‌ی هر تیم هنگام شروع نوبت +۱ می‌شود
 *  - پایان بازی: وقتی شمارنده‌ی آخرین تیم (ترتیب ساخت) از تعداد دور بیشتر شود → رتبه‌بندی
 *  - هر نوبت: تیم نوبت‌دار دسته را انتخاب می‌کند، «یک» کلمه بازی می‌شود و دیالوگ نتیجه باز می‌شود
 *  - زمان هر دسته ثابت است (setStableTime) + زمان اضافه‌ی انتخابی در ساخت بازی
 *  - تعویض کلمه: بدون محدودیت، هر بار −۱ (برای ضرب‌المثل ۲۰ امتیازی مخفی)
 *  - زمان اضافه: فقط ضرب‌المثل؛ هر بار −۱ و +۳۰ ثانیه (ریست کامل تایمر)
 *  - خطا: هر بار −۱؛ با سه خطا نوبت فوراً تمام و امتیاز کلمه صفر می‌شود
 *  - دیالوگ پایان: درست → پاداش (هر ۳۰ ثانیه باقی‌مانده = +۱)؛ غلط → امتیاز کلمه صفر
 *    جمع = امتیاز کلمه + تعویض + زمان اضافه + خطا → با ادامه به امتیاز تیم اضافه می‌شود
 *  - سرعتی: صف ۸ کلمه‌ای (نامحدود: ۸۰ کلمه) با درست/رد شدن/خطا
 *  - بوم: کلمه به کلمه؛ گوشی دست‌به‌دست می‌شود؛ درست = ثانیه‌های باقی‌مانده + ۱ امتیاز
 */
(function (global) {
  'use strict';

  function rnd(n) { return (Math.random() * n) | 0; }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* setStableTime — زمان ثابت هر دسته بر حسب ثانیه */
  function stableTime(cid, score) {
    if (cid === 40) {
      if (score === 1) return 90;
      if (score === 2) return 120;
      if (score === 3) return 150;
      if (score === 99) return 180;
      return 0;
    }
    if (cid === 50) {
      if (score === 2) return 90;
      if (score === 4) return 105;
      if (score === 6) return 120;
      if (score === 20) return 150;
      return 0;
    }
    if (cid === 60) return score === 5 ? 90 : 0;
    if (score === 1) return 45;
    if (score === 2) return 60;
    if (score === 3) return 75;
    return 0;
  }

  function Engine(data, opts) {
    this.data = data;
    this.opts = opts || {};
    this.gameType = this.opts.gameType || 'adabazi';   // 'adabazi' | 'boom'
    this.rounds = this.opts.rounds || 3;
    this.moreTime = this.opts.moreTime || 0;

    this.teams = (this.opts.teams || []).map(function (t, i) {
      return {
        name: t.name || ('گروه ' + (i + 1)),
        color: t.color == null ? i : t.color,
        score: 0,
        counter: 1,              // طبق اپ اصلی همه از ۱ شروع می‌کنند
        position: i === 0,       // تیم اول نوبت‌دار
        proverbState: false      // ضرب‌المثل ۲۰ امتیازی — هر تیم فقط یک بار
      };
    });
    this.n = this.teams.length;
    this.turnIndex = 0;          // تیمی که نوبتش رسیده (position=true)

    this.finished = false;
    this.turn = null;            // نوبت فعلی ادابازی
    this.boom = null;            // وضعیت بوم
    this.lastSummary = null;
    this.wordsPlayed = 0;        // آمار: کلمه‌های درست
    this.used = {};              // استخر کلمه — شبیه visibility در دیتابیس
  }

  /* دسته‌های کلماتی که در حالت «تصادفی/سرعتی» استفاده می‌شوند (بدون ۸۳ کودکان) */
  Engine.prototype.randomCids = function () {
    return (this.data.usableCategories || [])
      .filter(function (c) { return c.cid !== 83; })
      .map(function (c) { return c.cid; });
  };

  Engine.prototype.usedKey = function (cid, text) { return cid + '\u0000' + text; };

  /* استخر کلمه: وقتی کلمه‌ای استفاده شد علامت می‌خورد؛ اگر دسته تمام شد ریست می‌شود
   * (معادل updateVisibility در اپ اصلی) */
  Engine.prototype.markUsed = function (cid, text) {
    (this.used[cid] = this.used[cid] || {})[this.usedKey(cid, text)] = true;
  };
  Engine.prototype.isUsed = function (cid, text) {
    return !!(this.used[cid] && this.used[cid][this.usedKey(cid, text)]);
  };
  Engine.prototype.resetCategory = function (cids) {
    var self = this;
    cids.forEach(function (c) { self.used[c] = {}; });
  };

  /* انتخاب تصادفی یک کلمه — معادل SELECT ... ORDER BY RANDOM() LIMIT 1 */
  Engine.prototype.drawWord = function (cid, score) {
    var self = this, d = this.data;

    if (cid === 60) { /* ترانه */
      var songs = d.songs || [];
      var freeSongs = [];
      songs.forEach(function (s) {
        if (!self.isUsed(60, s.t)) freeSongs.push(s);
      });
      if (!freeSongs.length) { this.resetCategory([60]); freeSongs = songs.slice(); }
      var song = freeSongs[rnd(freeSongs.length)];
      return { cid: 60, text: song.t, sub: song.s, score: 5 };
    }

    var cids = cid === 69 ? this.randomCids() : [cid];
    var items = [];
    cids.forEach(function (c) {
      var arr = d.adabazi[String(c)] || [];
      for (var i = 0; i < arr.length; i++) {
        if (score === 0 || arr[i][1] === score) {
          items.push({ cid: c, text: arr[i][0], score: arr[i][1] });
        }
      }
    });
    var free = items.filter(function (x) { return !self.isUsed(x.cid, x.text); });
    if (!free.length) { this.resetCategory(cids); free = items; }
    if (!free.length) return null;
    var pick = free[rnd(free.length)];
    return { cid: pick.cid, text: pick.text, sub: '', score: pick.score };
  };

  /* صف سرعتی: ۸ کلمه تصادفی (نامحدود: ۸۰) */
  Engine.prototype.drawSpeedWords = function (score) {
    var self = this, cids = this.randomCids(), items = [];
    cids.forEach(function (c) {
      var arr = self.data.adabazi[String(c)] || [];
      for (var i = 0; i < arr.length; i++) {
        if (score === 99 || arr[i][1] === score) {
          items.push({ cid: c, text: arr[i][0], score: arr[i][1] });
        }
      }
    });
    shuffle(items);
    var out = items.slice(0, score === 99 ? 80 : 8);
    out.forEach(function (w) { self.markUsed(w.cid, w.text); });
    return out;
  };

  Engine.prototype.team = function (i) { return this.teams[i == null ? this.turnIndex : i]; };

  /* «دور X از Y» — طبق اپ اصلی: شمارنده‌ی آخرین تیم لیست */
  Engine.prototype.roundNumber = function () {
    return Math.max(1, this.teams[this.n - 1].counter);
  };
  /* پایان بازی: شمارنده‌ی آخرین تیم از تعداد دور گذشته باشد */
  Engine.prototype.isOver = function () {
    return this.teams[this.n - 1].counter > this.rounds;
  };

  /* ================================================================
   *  چرخش تیم‌ها — Continue در صفحه گروه
   *  طبق اپ اصلی: در لحظه‌ی Continue شمارنده‌ی تیم نوبت‌دار +۱ می‌شود
   *  و نشان position به تیم بعدی می‌رود؛ همین تیم شروع به بازی می‌کند.
   * ================================================================ */
  Engine.prototype.continueTurn = function () {
    if (this.finished) return false;
    var t = this.teams[this.turnIndex];
    t.counter++;                 // شروع نوبت این تیم
    t.position = false;
    var next = (this.turnIndex + 1) % this.n;
    this.teams[next].position = true;
    return true;
  };

  /* ================================================================
   *  نوبت ادابازی — یک کلمه در هر نوبت
   *  state: 1 = کلمه مخفی، 2 = کلمه نمایان/تایمر خاموش، 3 = در حال اجرا، 4 = دیالوگ نتیجه
   * ================================================================ */
  Engine.prototype.startTurn = function (cid, score) {
    var team = this.teams[this.turnIndex];
    var t = {
      cid: cid,
      score: score,              // امتیاز انتخابی (برای ۶۹ ممکن است صفر باشد)
      word: null,
      wordScore: 0,
      state: 1,
      running: false,
      changeState: 0,            // تعویض — هر بار −۱
      extraTimeState: 0,         // زمان اضافه — فقط ضرب‌المثل
      wrongCounter: 0,           // خطا — تا −۳
      stableTime: stableTime(cid, score) + this.moreTime,
      timeLeft: stableTime(cid, score) + this.moreTime,
      speedList: null,
      speedIndex: 0,
      playerName: team.name
    };

    if (cid === 40) { /* سرعتی */
      t.speedList = this.drawSpeedWords(score).map(function (w) {
        return { word: w, right: false };
      });
      if (!t.speedList.length) return null;
      t.word = t.speedList[0].word;
    } else {
      t.word = this.drawWord(cid, cid === 69 ? 0 : score);
      if (!t.word) return null;
      t.wordScore = t.word.score;
    }
    this.turn = t;
    return t;
  };

  /* پرس اول دکمه: نمایش کلمه */
  Engine.prototype.reveal = function () {
    var t = this.turn;
    if (!t || t.state !== 1) return false;
    t.state = 2;
    return true;
  };

  /* پرس دوم: شروع تایمر — کلمه مصرف می‌شود و قانون ۲۰ امتیازی فعال می‌گردد */
  Engine.prototype.run = function () {
    var t = this.turn;
    if (!t || t.state !== 2) return false;
    t.state = 3;
    t.running = true;
    if (t.cid !== 40) {
      this.markUsed(t.word.cid, t.word.text);
      if (t.score === 20) {
        this.teams[this.turnIndex].proverbState = true;
      }
    }
    return true;
  };

  /* پرس سوم: پایان (Stop) → دیالوگ نتیجه */
  Engine.prototype.stop = function () {
    var t = this.turn;
    if (!t || t.state !== 3 || !t.running) return false;
    t.running = false;
    t.state = 4;
    return 'dialog';
  };

  /* تیک تایمر (۱ ثانیه) */
  Engine.prototype.tick = function () {
    var t = this.turn;
    if (!t || !t.running) return 0;
    t.timeLeft--;
    if (t.timeLeft <= 0) {
      t.timeLeft = 0;
      t.running = false;
      t.state = 4;
      return 'timeout';
    }
    return t.timeLeft;
  };

  /* تعویض کلمه — بی‌نهایت بار، هر بار −۱ (به‌جز ضرب‌المثل ۲۰ امتیازی) */
  Engine.prototype.change = function () {
    var t = this.turn;
    if (!t || t.state === 1 || t.state === 4) return false;
    if (t.cid === 40) return false;          // سرعتی دکمه تعویض ندارد
    if (t.score === 20 && t.cid === 50) return false;
    t.changeState--;
    var nw;
    if (t.cid === 69) {
      nw = this.drawWord(69, 0);             // تصادفی از همه دسته‌ها
    } else if (t.cid === 60) {
      nw = this.drawWord(60, 0);
    } else {
      nw = this.drawWord(t.cid, t.score);
    }
    if (nw) {
      t.word = nw;
      t.wordScore = nw.score;
    }
    return true;
  };

  /* زمان اضافه — فقط ضرب‌المثل؛ هر بار −۱ و +۳۰ ثانیه (ریست کامل تایمر) */
  Engine.prototype.extraTime = function () {
    var t = this.turn;
    if (!t || t.cid !== 50) return false;
    if (t.state === 1 || t.state === 4) return false;
    t.extraTimeState--;
    t.stableTime += 30;
    t.timeLeft = t.stableTime;      // کانت‌داون از نو با کل زمان (مطابق اپ اصلی)
    return true;
  };

  /* خطا — هر بار −۱؛ سه خطا = پایان فوری نوبت با امتیاز صفر */
  Engine.prototype.fault = function () {
    var t = this.turn;
    if (!t || t.state === 4) return false;
    t.wrongCounter--;
    if (t.wrongCounter <= -3) {
      t.wordScore = 0;
      t.running = false;
      t.state = 4;
      return 'faultout';       // دیالوگ بدون دکمه درست/غلط
    }
    return true;
  };

  /* ---- دیالوگ نتیجه ---- */

  /* درست: پاداش زمان — هر ۳۰ ثانیه باقی‌مانده = +۱ */
  Engine.prototype.dialogRight = function () {
    var t = this.turn;
    if (!t) return 0;
    var bonus = Math.floor(t.timeLeft / 30);
    t.extraTimeState += bonus;
    this.wordsPlayed++;
    return this.total();
  };

  /* غلط: امتیاز کلمه صفر */
  Engine.prototype.dialogWrong = function () {
    var t = this.turn;
    if (!t) return 0;
    t.wordScore = 0;
    return this.total();
  };

  Engine.prototype.total = function () {
    var t = this.turn;
    if (!t) return 0;
    return t.wordScore + t.changeState + t.extraTimeState + t.wrongCounter;
  };

  /* ثبت نتیجه و رفتن به صفحه گروه — خروجی: نوع خلاصه */
  Engine.prototype.commitTurn = function (total) {
    var t = this.turn;
    var type = 'next-turn';
    if (t) this.teams[this.turnIndex].score += total;
    this.lastSummary = { team: this.turnIndex, total: total };
    if (this.isOver()) {
      type = 'end';
      this.finished = true;
    }
    this.turn = null;
    this.turnIndex = (this.turnIndex + 1) % this.n;   // نوبت بعدی
    this.lastSummary.type = type;
    return this.lastSummary;
  };

  /* ================================================================
   *  حالت سرعتی — دکمه‌های درست / رد شدن / خطا
   * ================================================================ */
  Engine.prototype.speedTrue = function () {
    var t = this.turn;
    if (!t || t.cid !== 40 || t.state !== 3) return false;
    t.speedList[t.speedIndex].right = true;
    this.wordsPlayed++;
    return this.speedNext();
  };

  Engine.prototype.speedChange = function () {
    var t = this.turn;
    if (!t || t.cid !== 40 || t.state !== 3) return false;
    return this.speedNext();
  };

  Engine.prototype.speedNext = function () {
    var t = this.turn;
    if (t.speedIndex >= t.speedList.length - 1) {   // آخرین کلمه
      t.running = false;
      t.state = 4;
      return 'dialog';
    }
    t.speedIndex++;
    t.word = t.speedList[t.speedIndex].word;
    return true;
  };

  Engine.prototype.speedFault = function () {
    var t = this.turn;
    if (!t || t.cid !== 40 || t.state !== 3) return false;
    t.wrongCounter--;
    if (t.wrongCounter <= -3) {
      t.running = false;
      t.state = 4;
      return 'faultout';
    }
    return true;
  };

  /* جمع سرعتی: کلمه‌های درست + خطاها */
  Engine.prototype.speedTotal = function () {
    var t = this.turn;
    if (!t) return 0;
    var sum = 0;
    t.speedList.forEach(function (x) { if (x.right) sum += x.word.score; });
    return sum + t.wrongCounter;
  };

  /* ================================================================
   *  بوم — کلمه به کلمه، دست‌به‌دست شدن گوشی
   * ================================================================ */
  Engine.prototype.startBoom = function () {
    this.boom = {
      state: 1,                // 1=آماده  2=نمایان  3=در حال اجرا  4=نتیجه
      running: false,
      word: null,
      player: this.turnIndex,  // تیمی که گوشی دستشه
      active: 0,               // تیم صاحب کلمه فعلی
      timeLeft: this.moreTime,
      finalRound: false
    };
    return this.boom;
  };

  /* پرس اول: نمایش کلمه + چرخش گروه‌ها + شمارنده++ */
  Engine.prototype.boomReveal = function () {
    var b = this.boom;
    if (!b || b.state !== 1) return false;
    var w = this.drawBoomWord();
    if (!w) return false;
    b.word = w;
    b.active = b.player;
    b.state = 2;

    var team = this.teams[b.active];
    team.counter++;
    team.position = false;
    b.player = (b.active + 1) % this.n;
    this.teams[b.player].position = true;
    this.turnIndex = b.player;

    /* کلمه آخر؟ */
    if (this.isOver()) b.finalRound = true;
    return true;
  };

  Engine.prototype.drawBoomWord = function () {
    var self = this, pool = this.data.boom || [];
    var free = pool.filter(function (w) { return !self.isUsed(0, w); });
    if (!free.length) { this.resetCategory([0]); free = pool.slice(); }
    if (!free.length) return null;
    var w = free[rnd(free.length)];
    return w;
  };

  /* پرس دوم: شروع تایمر (زمان هر کلمه = moreTime) */
  Engine.prototype.boomRun = function () {
    var b = this.boom;
    if (!b || b.state !== 2) return false;
    b.state = 3;
    b.running = true;
    this.markUsed(0, b.word);
    return true;
  };

  Engine.prototype.boomTick = function () {
    var b = this.boom;
    if (!b || !b.running) return 0;
    b.timeLeft--;
    if (b.timeLeft <= 0) {
      b.timeLeft = 0;
      b.running = false;
      return 'timeout';
    }
    return b.timeLeft;
  };

  /* درست: امتیاز = ثانیه‌های باقی‌مانده + ۱ */
  Engine.prototype.boomTrue = function () {
    var b = this.boom;
    if (!b || b.state !== 3 || !b.running) return 0;
    b.running = false;
    b.state = 4;
    var gain = Math.floor(b.timeLeft) + 1;
    this.teams[b.active].score += gain;
    return gain;
  };

  /* غلط / پایان زمان: صفر امتیاز */
  Engine.prototype.boomFalse = function () {
    var b = this.boom;
    if (!b || b.state !== 3) return 0;
    b.running = false;
    b.state = 4;
    return 0;
  };

  /* بعد از نتیجه: کلمه بعدی یا پایان بازی */
  Engine.prototype.boomNext = function () {
    var b = this.boom;
    if (!b) return 'next-word';
    if (b.finalRound) {
      this.finished = true;
      this.lastSummary = { type: 'end', team: b.active };
      return 'end';
    }
    b.state = 1;
    b.running = false;
    b.word = null;
    b.finalRound = false;
    return 'next-word';
  };

  /* ================================================================
   *  رتبه‌بندی و اشتراک
   * ================================================================ */
  Engine.prototype.rank = function () {
    return this.teams.slice().sort(function (a, b) { return b.score - a.score; });
  };

  Engine.prototype.winner = function () {
    var r = this.rank();
    return r[0].score === r[1].score ? null : r[0];
  };

  Engine.prototype.shareText = function () {
    var r = this.rank();
    var mode = this.gameType === 'boom' ? 'بوم' : 'ادابازی';
    function num(v) {
      return v >= 0 ? String(v) : (Math.abs(v) + '-');
    }
    var s = mode + ':\nنتیجه رقابتمون در ' + this.rounds + ' دور بازی\n\n' +
      'مقام اول: ' + r[0].name + ' با ' + num(r[0].score) + ' امتیاز\n' +
      'مقام دوم: ' + r[1].name + ' با ' + num(r[1].score) + ' امتیاز\n';
    if (r.length > 2) s += 'مقام سوم: ' + r[2].name + ' با ' + num(r[2].score) + ' امتیاز\n';
    return s;
  };

  global.GameEngine = Engine;
})(typeof window !== 'undefined' ? window : this);
