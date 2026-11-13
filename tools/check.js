/* ============================================================
   بررسی خودکار کیفیت — قبل از هر انتشار اجرا می‌شود
   ------------------------------------------------------------
   استفاده:  node tools/check.js [مسیر ریشه‌ی وب‌اپ]
   پیش‌فرض:  ./www
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www'));
let problems = [];
let checks = 0;

function ok(label, extra) { checks++; console.log('  ✓ ' + label + (extra ? ' — ' + extra : '')); }
function bad(msg) { problems.push(msg); console.log('  ✗ ' + msg); }

/* ---------- ۱) ساختار CSS ---------- */
function checkCss(file) {
  if (!fs.existsSync(file)) { bad('فایل CSS پیدا نشد: ' + file); return; }
  const css = fs.readFileSync(file, 'utf8');
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const open = (stripped.match(/\{/g) || []).length;
  const close = (stripped.match(/\}/g) || []).length;
  if (open !== close) bad(file + ': براکت نامتوازن (' + open + ' / ' + close + ')');

  [...stripped.matchAll(/\{([^}]*)\}/g)].forEach(v => {
    const o = (v[1].match(/\(/g) || []).length, c = (v[1].match(/\)/g) || []).length;
    if (o !== c) bad(file + ': پرانتز نامتوازن → ' + v[1].trim().slice(0, 50));
  });

  let i = 0, rules = 0;
  while (i < stripped.length) {
    const brace = stripped.indexOf('{', i);
    if (brace < 0) break;
    const start = Math.max(stripped.lastIndexOf('}', brace - 1), stripped.lastIndexOf(';', brace - 1), stripped.lastIndexOf('{', brace - 1)) + 1;
    const sel = stripped.slice(start, brace).trim();
    if (!sel) bad(file + ': سلکتور خالی');
    else if (/^[0-9]/.test(sel)) bad(file + ': سلکتور نامعتبر → ' + sel.slice(0, 40));
    else if (sel.includes('=====')) bad(file + ': نشانه‌ی خرابی → ' + sel.slice(0, 40));
    rules++;
    let depth = 0, k = brace;
    for (; k < stripped.length; k++) {
      if (stripped[k] === '{') depth++;
      else if (stripped[k] === '}') { depth--; if (depth === 0) break; }
    }
    i = k + 1;
  }
  ok('CSS ساختاری سالم', rules + ' قاعده');
}

/* ---------- ۲) مارک‌آپ تولیدشده در JS ---------- */
function checkMarkup(file) {
  if (!fs.existsSync(file)) { bad('فایل JS پیدا نشد: ' + file); return; }
  const src = fs.readFileSync(file, 'utf8');
  const calls = [];
  let i = 0;
  while (true) {
    const idx = src.indexOf("h('", i);
    if (idx < 0) break;
    let j = idx + 2, depth = 1, inStr = false, str = '';
    while (j < src.length && depth > 0) {
      const ch = src[j];
      if (inStr) {
        if (ch === '\\') { str += src[j + 1]; j += 2; continue; }
        if (ch === "'") { inStr = false; j++; continue; }
        str += ch; j++; continue;
      }
      if (ch === "'") { inStr = true; j++; continue; }
      if (ch === '(') depth++;
      if (ch === ')') { depth--; if (depth === 0) break; }
      j++;
    }
    calls.push(str);
    i = j + 1;
  }
  const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'path', 'circle', 'rect', 'use']);
  let issues = 0;
  calls.forEach((s, idx) => {
    if (!s.includes('<')) return;
    const tags = [...s.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)];
    const stack = [];
    tags.forEach(t => {
      const closing = t[1] === '/';
      const name = t[2].toLowerCase();
      if (VOID.has(name) || t[4] === '/') return;
      if (!closing) stack.push(name);
      else {
        const last = stack.pop();
        if (last !== name) { bad('مارک‌آپ #' + idx + ': </' + name + ' اما <' + last + '> باز بود'); issues++; return; }
      }
    });
    if (stack.length) { bad('مارک‌آپ #' + idx + ': تگ‌های بسته‌نشده: ' + stack.join(',')); issues++; }
  });
  ok('مارک‌آپ سالم', calls.length + ' فراخوانی h()');
}

/* ---------- ۳) ارجاع به شناسه‌ها ---------- */
function checkIds(root) {
  const jsFiles = ['js/app.js', 'js/game.js', 'js/confetti.js', 'js/audio.js', 'js/store.js', 'js/data.js', 'js/icons.js'];
  let all = '';
  jsFiles.forEach(f => { const p = path.join(root, f); if (fs.existsSync(p)) all += fs.readFileSync(p, 'utf8') + '\n'; });
  const htmlPath = path.join(root, 'index.html');
  if (fs.existsSync(htmlPath)) all += fs.readFileSync(htmlPath, 'utf8');

  const created = new Set();
  for (const m of all.matchAll(/\bid=["']([A-Za-z0-9_-]+)["']/g)) created.add(m[1]);
  for (const m of all.matchAll(/\.id\s*=\s*['"]([A-Za-z0-9_-]+)['"]/g)) created.add(m[1]);
  for (const m of all.matchAll(/setAttribute\(\s*['"]id['"]\s*,\s*['"]([A-Za-z0-9_-]+)['"]/g)) created.add(m[1]);
  /* شناسه‌های ساخته‌شده به‌صورت پویا: id="' + id + '" */
  const dynamic = new Set([...all.matchAll(/id=["']\s*["']\s*\+\s*([A-Za-z0-9_]+)\s*\+\s*["']/g)].map(m => m[1]));
  /* نمونه‌هایی مثل gaugeMarkup(x, 'gauge') که شناسه را در قالب HTML می‌سازند */
  for (const m of all.matchAll(/gaugeMarkup\([^,]+,\s*'([^']+)'\)/g)) dynamic.add(m[1]);

  const reads = new Map();
  const re = /(?:querySelector(?:All)?\(\s*['"]#([A-Za-z0-9_-]+)|getElementById\(\s*['"]([A-Za-z0-9_-]+)['"])/g;
  let mm;
  while ((mm = re.exec(all))) {
    const id = mm[1] || mm[2];
    if (!reads.has(id)) reads.set(id, []);
    reads.get(id).push(all.slice(0, mm.index).split('\n').length);
  }
  let broken = 0;
  for (const [id, lines] of reads) {
    if (created.has(id)) continue;
    if (dynamic.has(id)) continue;            /* به‌صورت پویا ساخته می‌شود */
    /* اگر رشته‌ی شناسه جایی در کد آمده باشد، احتمالاً در قالب HTML ساخته می‌شود */
    if (all.indexOf("'" + id + "'") > -1 || all.indexOf('"' + id + '"') > -1) continue;
    bad('شناسه‌ی ساخته‌نشده: #' + id + ' (خط ' + lines[0] + ')');
    broken++;
  }
  ok('ارجاع شناسه‌ها', broken ? broken + ' مشکل' : 'بدون ارجاع شکسته');
}

/* ---------- ۴) هماهنگی نسخه ---------- */
function checkVersion(root) {
  const htmlPath = path.join(root, 'index.html');
  const jsPath = path.join(root, 'js/app.js');
  if (!fs.existsSync(htmlPath) || !fs.existsSync(jsPath)) { bad('index.html یا js/app.js پیدا نشد'); return; }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  const appV = (js.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
  const purgeV = (html.match(/var V\s*=\s*'([^']+)'/) || [])[1];
  const refs = [...html.matchAll(/\?v=(\d+\.\d+\.\d+)/g)].map(m => m[1]);
  const uniq = [...new Set(refs)];

  if (!appV) { bad('APP_VERSION در js/app.js پیدا نشد'); return; }
  if (uniq.length !== 1 || uniq[0] !== appV) bad('نسخه‌ی دارایی‌های index.html (' + uniq.join(',') + ') با APP_VERSION (' + appV + ') یکی نیست');
  if (purgeV && purgeV !== appV) bad('نسخه‌ی اسکریپت ضدکش (' + purgeV + ') با APP_VERSION (' + appV + ') یکی نیست');

  /* فایل‌های ارجاع‌شده باید واقعاً وجود داشته باشند */
  [...html.matchAll(/(?:href|src)="([^"]+)\?v=/g)].forEach(m => {
    const p = path.join(root, m[1]);
    if (!fs.existsSync(p)) bad('فایل ارجاع‌شده وجود ندارد: ' + m[1]);
  });

  ok('نسخه‌ها یکسان', appV + ' (' + refs.length + ' ارجاع)');
}

/* ---------- اجرا ---------- */
console.log('بررسی کیفیت: ' + ROOT);
checkCss(path.join(ROOT, 'css/app.css'));
checkCss(path.join(ROOT, 'css/tokens.css'));
checkMarkup(path.join(ROOT, 'js/app.js'));
checkIds(ROOT);
checkVersion(ROOT);

console.log('');
if (problems.length) {
  console.log('❌ مشکلات: ' + problems.length);
  problems.slice(0, 20).forEach(p => console.log('   - ' + p));
  process.exit(1);
}
console.log('همه بررسی‌ها سبز (' + checks + ' مورد)');
