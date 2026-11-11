/* موتور بازی — منطق خالص، بدون DOM */
(function (global) {
  'use strict';

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function Engine(data, opts) {
    this.data = data;
    this.opts = opts; // {mode, categories:[cid], teams:[{name,color}], rounds, roundTime, wordsPerTurn, timeReward}
    this.mode = opts.mode;
    this.teams = opts.teams.map(function (t, i) {
      return { name: t.name, color: t.color == null ? i : t.color, score: 0 };
    });
    this.round = 1;
    this.turnIndex = 0;          // شاخص تیم نوبت‌دار
    this.turnsInRound = 0;
    this.totalWords = 0;
    this.log = [];               // رکورد کلمه‌ها برای بازگشت
    this.roundDelta = this.teams.map(function () { return 0; });
    this.finished = false;
    this.pool = this.buildPool();
    this.phase = 'setup';        // setup | show | running | paused | finished
    this.timeState = 'ready';    // ready | running | paused | finished
    this.timeLeft = this.opts.roundTime;
    this.over = false;
    this.turnActions = 0;
    this.faults = 0;              // E — مجموع جریمه خطاها در نوبت
    this.swapUsed = false;        // R — آیا از تعویض کلمه استفاده شد
    this.swapPenalty = 0;         // R — جریمه تعویض (۱)
    this.turnScore = 0;           // S — امتیاز نهایی نوبت
    this.turnCorrect = 0;        // تعداد پاسخ‌های صحیح
    this.startTurn();
  }

  Engine.prototype.buildPool = function () {
    var d = this.data, pool = [];
    if (this.mode === 'boom') {
      d.boom.forEach(function (w) { pool.push({ text: w, score: 3 }); });
    } else if (this.mode === 'songs') {
      d.songs.forEach(function (s) {
        pool.push({ text: s.t, sub: s.s, score: s.s && s.s.score ? s.s.score : 5 });
      });
    } else {
      var cats = this.opts.categories && this.opts.categories.length
        ? this.opts.categories
        : d.usableCategories.map(function (c) { return c.cid; });
      cats.forEach(function (cid) {
        (d.adabazi[String(cid)] || []).forEach(function (w) {
          pool.push({ text: w[0], score: w[1] });
        });
      });
    }
    return shuffle(pool);
  };

  Engine.prototype.startTurn = function () {
    var n = this.opts.wordsPerTurn;
    var queue = [];
    for (var i = 0; i < n; i++) {
      var w = this.pool.pop();
      if (!w) { this.pool = shuffle(this.buildPool()); w = this.pool.pop(); }
      if (!w) break;
      queue.push(w);
    }
    this.queue = queue;
    this.wordIndex = 0;
    this.turnScore = 0;
    this.turnCorrect = 0;
    this.timeLeft = this.opts.roundTime;
    this.over = false;
    this.turnActions = 0;
    this.phase = 'setup';
    this.timeState = 'ready';
    this.faults = 0;
    this.swapUsed = false;
    this.swapPenalty = 0;
  };

  Engine.prototype.currentWord = function () {
    return this.queue[this.wordIndex] || null;
  };

  Engine.prototype.team = function () {
    return this.teams[this.turnIndex];
  };

  /* ---- فازهای نوبت: setup(show مخفی) -> show(کلمه) -> running -> paused|finished ---- */
  Engine.prototype.show = function () {
    if (this.phase !== 'setup') return false;
    this.phase = 'show';
    this.timeState = 'ready';
    return true;
  };

  Engine.prototype.startTimer = function () {
    if (this.phase !== 'show' && this.phase !== 'paused') return false;
    var fromPaused = (this.phase === 'paused');
    this.phase = 'running';
    this.timeState = 'running';
    if (!fromPaused) this.timeLeft = this.opts.roundTime;
    return true;
  };

  Engine.prototype.pauseTimer = function () {
    if (this.phase !== 'running') return false;
    this.phase = 'paused';
    this.timeState = 'paused';
    return true;
  };

  Engine.prototype.addFault = function () {
    if (this.phase === 'finished') return false;
    this.faults++;
    return true;
  };

  /* تعویض کلمه: فقط یک بار در هر نوبت؛ جریمه -۱ (R) و تایمر ریست نمیشود */
  Engine.prototype.swapWord = function () {
    if (this.phase !== 'show' && this.phase !== 'running') return false;
    if (this.swapUsed) return false;
    var w = this.currentWord();
    if (!w) return false;
    var replaced = null;
    if (this.mode === 'boom') {
      replaced = { text: this.data.boom[(Math.random() * this.data.boom.length) | 0], score: 3 };
    } else if (this.mode === 'songs') {
      replaced = { text: this.data.songs[(Math.random() * this.data.songs.length) | 0].t, sub: this.data.songs[(Math.random() * this.data.songs.length) | 0].s, score: 5 };
    } else {
      // همان دسته و همان امتیاز
      var targetCid = null, targetArr = null;
      for (var cid in this.data.adabazi) {
        var arr = this.data.adabazi[cid] || [];
        for (var i = 0; i < arr.length; i++) {
          if (arr[i][0] === w.text) { targetCid = cid; targetArr = arr; break; }
        }
        if (targetCid) break;
      }
      var same = targetArr ? targetArr.filter(function (x) { return x[1] === w[1]; }) : [];
      replaced = same.length ? same[(Math.random() * same.length) | 0] : { text: 'کلمه‌ی جدید', score: w[1] };
    }
    this.queue[this.wordIndex] = replaced;
    this.swapUsed = true;
    this.swapPenalty = 1;
    return true;
  };

  /* پاسخ: 'correct' | 'wrong' | 'skip' — با فرمول امتیاز نوبت: S = P - E - R + B */
  Engine.prototype.answer = function (kind) {
    var w = this.currentWord();
    if (!w) return null;
    if (this.phase === 'finished') return null;
    if (this.phase !== 'show' && this.phase !== 'running') return null;

    var rec = { word: w, kind: kind, team: this.turnIndex, gained: 0, delta: 0 };
    var S = 0;

    if (kind === 'correct') {
      var B = this.opts.timeReward ? 1 : 0;
      S = w.score - this.faults - this.swapPenalty + B;
      this.teams[this.turnIndex].score += S;
      this.turnScore = S;
      this.turnCorrect++;
      this.roundDelta[this.turnIndex] += S;
      this.totalWords++;
      rec.gained = w.score;
    } else {
      S = -this.faults - this.swapPenalty;
      this.teams[this.turnIndex].score += S;
      this.turnScore = S;
    }
    rec.delta = S;

    this.log.push(rec);
    this.wordIndex++;
    this.turnActions++;

    if (this.phase === 'running' && this.timeLeft <= 0) this.endTurn();
    else if (this.wordIndex >= this.queue.length) this.endTurn();
    return rec;
  };

  /* بازگشت یک قدم — فقط داخل نوبت جاری */
  Engine.prototype.undo = function () {
    if (!this.log.length || !this.turnActions) return false;
    var rec = this.log.pop();
    this.turnActions--;
    this.teams[rec.team].score -= rec.delta;
    this.roundDelta[rec.team] -= rec.delta;
    this.turnScore -= rec.delta;
    if (rec.kind === 'correct') this.totalWords--;
    this.wordIndex = Math.max(0, this.wordIndex - 1);
    if (this.queue[this.wordIndex] !== rec.word) {
      this.queue.splice(this.wordIndex, 0, rec.word);
    }
    return true;
  };

  Engine.prototype.tick = function () {
    if (this.phase !== 'running') return this.timeLeft;
    this.timeLeft--;
    if (this.timeLeft <= 0) {
      this.phase = 'finished';
      this.timeState = 'finished';
      this.endTurn();
      return 0;
    }
    return this.timeLeft;
  };

  Engine.prototype.skipTurn = function () {
    if (this.phase === 'finished') return;
    this.endTurn();
  };

  Engine.prototype.endTurn = function () {
    if (this.over) return;
    this.over = true;
    this.phase = 'finished';
    this.timeState = 'finished';

    var summary = {
      team: this.turnIndex,
      gained: this.turnScore,
      correct: this.turnCorrect,
      totals: this.teams.map(function (t) { return t.score; })
    };

    if (this.turnsInRound + 1 >= this.teams.length) {
      // پایان دور
      if (this.round >= this.opts.rounds) {
        this.finished = true;
        summary.end = true;
      } else {
        summary.roundEnd = true;
      }
    } else {
      // نوبت تیم بعدی
      this.turnIndex = (this.turnIndex + 1) % this.teams.length;
      this.turnsInRound = 0;
      this.startTurn();
    }
    return summary;
  };

  Engine.prototype.nextRound = function () {
    this.round++;
    this.turnsInRound = 0;
    this.turnIndex = 0;
    this.roundDelta = this.teams.map(function () { return 0; });
    this.startTurn();
  };

  Engine.prototype.continueAfterTurn = function () {
    this.startTurn();
  };

  Engine.prototype.winner = function () {
    var best = 0;
    for (var i = 1; i < this.teams.length; i++) {
      if (this.teams[i].score > this.teams[best].score) best = i;
    }
    var tie = this.teams.every(function (t) { return t.score === this.teams[best].score; }, this);
    return tie ? null : this.teams[best];
  };

  Engine.prototype.isTie = function () {
    var first = this.teams[0].score;
    return this.teams.every(function (t) { return t.score === first; });
  };

  global.GameEngine = Engine;
})(window);
