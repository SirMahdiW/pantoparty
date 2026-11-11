/* کانفتی مربعی (block-based) روی canvas — بدون وابستگی */
(function (global) {
  'use strict';

  var COLORS = ['#7C3AED', '#A78BFA', '#F43F5E', '#FF4FA3', '#22D3EE', '#38BDF8', '#FBBF24', '#FB923C', '#34D399', '#A3E635'];
  var canvas = null, ctx = null, raf = 0, pieces = [], running = false;

  function ensure() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
    canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function spawn(n) {
    var dpr = window.devicePixelRatio || 1;
    var W = window.innerWidth, H = window.innerHeight;
    for (var i = 0; i < n; i++) {
      pieces.push({
        x: Math.random() * W * dpr,
        y: -20 - Math.random() * H * 0.4 * dpr,
        w: (7 + Math.random() * 11) * dpr,
        h: (7 + Math.random() * 11) * dpr,
        vx: (Math.random() - 0.5) * 3.2 * dpr,
        vy: (2.4 + Math.random() * 4.2) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.24,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1
      });
    }
  }

  function frame() {
    if (!running) return;
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i];
      p.vy += 0.055 * dpr;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H + 40) p.life -= 0.06;
      if (p.life <= 0) { pieces.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (pieces.length === 0) {
      running = false;
      ctx.clearRect(0, 0, W, H);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  var Confetti = {
    burst: function (count) {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      ensure();
      spawn(count || 120);
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    },
    stop: function () {
      running = false;
      pieces = [];
      cancelAnimationFrame(raf);
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  global.Confetti = Confetti;
})(window);
