/* ============================================================
   ╪¬╪│╪¬ ┘à┘ê╪¬┘ê╪▒ ╪¿╪º╪▓█î ╪º╪»╪º╪¿╪º╪▓█î ΓÇö ╪¿╪º╪▓╪│╪º╪▓█î ┘à┘å╪╖┘é ╪º┘╛ ╪º╪╡┘ä█î
   ------------------------------------------------------------
   ╪º╪¼╪▒╪º:   node tests/engine.test.js
   ╪«╪▒┘ê╪¼█î:  ┘ç╪▒ ╪¬╪│╪¬ ╪¿╪º Γ£ô █î╪º Γ£ù ┘ê ╪»╪▒ ┘╛╪º█î╪º┘å ╪«┘ä╪º╪╡┘çΓÇî█î PASS / FAIL
   ┘å┌⌐╪¬┘ç:   ╪º█î┘å ┘ü╪º█î┘ä ┘ü┘é╪╖ ┬½┘à┘ê╪¬┘ê╪▒┬╗ (js/game.js) ╪▒╪º ┘à█îΓÇî╪ó╪▓┘à╪º█î╪» ΓÇö
           ┘à┘å╪╖┘é ╪º┘à╪¬█î╪º╪▓╪î ╪▓┘à╪º┘åΓÇî┘ç╪º╪î ╪º┘å╪¬╪«╪º╪¿ ┌⌐╪º╪▒╪¬╪î ╪│╪▒╪╣╪¬█î╪î ╪¿┘ê┘à ┘ê ┘╛╪º█î╪º┘å ╪¿╪º╪▓█î.
   ============================================================ */
'use strict';

const path = require('path');
const APP = path.resolve(__dirname, '..', 'www');   // ╪▒█î╪┤┘çΓÇî█î ┘╛╪▒┘ê┌ÿ┘ç

const engineMod = require(path.join(APP, 'js/game.js'));
const GameEngine = engineMod.GameEngine || engineMod;
const words = require(path.join(APP, 'data/words.json'));

/* normalize ┘à╪½┘ä data.js */
const usableCategories = words.categories.filter(c => c.cid >= 70 && words.adabazi[String(c.cid)]);
const data = {
  categories: words.categories,
  usableCategories,
  adabazi: words.adabazi,
  boom: words.boom,
  songs: words.songs
};

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 FAIL: ' + name); }
}
function section(name) { console.log('\n== ' + name + ' =='); }

function makeEngine(teams, rounds, moreTime, gameType) {
  return new GameEngine(data, {
    gameType: gameType || 'adabazi',
    teams: (teams || ['A', 'B', 'C']).map((n, i) => ({ name: '\u06AF\u0631\u0648\u0647 ' + n, color: i })),
    rounds: rounds == null ? 3 : rounds,
    moreTime: moreTime || 0
  });
}

/* ---------- █▒) ╪▓┘à╪º┘åΓÇî┘ç╪º█î ╪½╪º╪¿╪¬ ╪»╪│╪¬┘çΓÇî┘ç╪º ---------- */
section('\u0632\u0645\u0627\u0646 \u062B\u0627\u0628\u062A \u062F\u0633\u062A\u0647\u0647\u0627');
const timesCases = [
  [40, 1, 90], [40, 2, 120], [40, 3, 150], [40, 99, 180],
  [50, 2, 90], [50, 4, 105], [50, 6, 120], [50, 20, 150],
  [60, 5, 90], [70, 1, 45], [70, 2, 60], [70, 3, 75]
];
timesCases.forEach(([cid, sc, want]) => {
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(cid, sc);
  ok(t && t.stableTime === want, `cid ${cid} score ${sc} \u2192 ${want}s (got ${t.stableTime})`);
  e.turn = null;
});

/* ---------- █▓) ╪▓┘à╪º┘å ╪º╪╢╪º┘ü┘çΓÇî█î ╪¿╪º╪▓█î ---------- */
section('\u0632\u0645\u0627\u0646 \u0627\u0636\u0627\u0641\u0647\u0654 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC \u062F\u0631 \u0633\u0627\u062E\u062A \u0628\u0627\u0632\u06CC');
{
  const e = makeEngine(['A', 'B'], 3, 15);
  const t = e.startTurn(70, 2);
  ok(t.stableTime === 60 + 15, 'word score2: 60 + 15 = 75 (got ' + t.stableTime + ')');
}

/* ---------- █│) ╪¼╪▒█î╪º┘å ┘å┘ê╪¿╪¬: reveal \u2192 run \u2192 tick \u2192 timeout \u2192 dialog ---------- */
section('\u062C\u0631\u06CC\u0627\u0646 \u0646\u0648\u0628\u062A');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(70, 2);
  ok(t.state === 1, 'state1: \u06A9\u0644\u0645\u0647 \u0645\u062E\u0641\u06CC');
  ok(e.reveal() === true && t.state === 2, 'reveal \u2192 state2');
  ok(e.run() === true && t.state === 3 && t.running, 'run \u2192 state3 \u0648 \u062A\u0627\u06CC\u0645\u0631 \u0631\u0627\u0646');
  ok(e.isUsed(t.word.cid, t.word.text), '\u06A9\u0644\u0645\u0647 \u0645\u0635\u0631\u0641 \u0634\u062F (visibility)');
  for (let i = 0; i < 59; i++) e.tick();
  const r = e.tick();
  ok(r === 'timeout' && t.timeLeft === 0 && t.state === 4, 'timeout \u2192 dialog (state4)');
  /* timeout \u2192 \u062F\u0631\u0633\u062A \u2192 \u0628\u0648\u0646\u0648\u0633 \u0635\u0641\u0631 */
  const before = t.extraTimeState;
  e.dialogRight();
  ok(t.extraTimeState === before, 'timeout + \u062F\u0631\u0633\u062A: \u0628\u0648\u0646\u0648\u0633 0');
  ok(e.total() === t.wordScore + t.changeState + t.extraTimeState + t.wrongCounter, '\u062C\u0645\u0639 = S+C+E+W');
}

/* ---------- █┤) \u062F\u06CC\u0627\u0644\u0648\u06AF: \u062F\u0631\u0633\u062A \u2192 \u067E\u0627\u062F\u0627\u0634 30\u062B ---------- */
section('\u067E\u0627\u062F\u0627\u0634 \u0632\u0645\u0627\u0646 \u0628\u0627\u0642\u06CC\u200C\u0645\u0627\u0646\u062F\u0647');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(70, 1);            // 45\u062B
  e.reveal(); e.run();
  for (let i = 0; i < 30; i++) e.tick();   // 45 \u2192 15 \u062B\u0627\u0646\u06CC\u0647 \u0645\u0627\u0646\u062F\u0647
  e.stop();
  e.dialogRight();
  ok(t.extraTimeState === 0, '15\u062B \u2192 floor(15/30)=0 (got ' + t.extraTimeState + ')');
}
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(70, 3);
  e.reveal(); e.run();
  /* \u0632\u0645\u0627\u0646 \u0627\u0636\u0627\u0641\u0647 \u0645\u0627\u0646\u0646\u062F \u062F\u0633\u062A\u06CC \u062A\u0627\u06CC\u0645\u0631 \u0631\u0627 \u0628\u0627\u0644\u0627 \u0628\u0628\u0631 */
  t.timeLeft = 64;
  e.stop();
  e.dialogRight();
  ok(t.extraTimeState === 2, '64\u062B \u2192 floor(64/30)=2 (got ' + t.extraTimeState + ')');
}

/* ---------- █╡) \u063A\u0644\u0637: \u0627\u0645\u062A\u06CC\u0627\u0632 \u06A9\u0644\u0645\u0647 \u0635\u0641\u0631 ---------- */
section('\u063A\u0644\u0637 \u062F\u0631 \u062F\u06CC\u0627\u0644\u0648\u06AF');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(70, 3);
  const ws = t.wordScore;
  e.reveal(); e.run(); e.stop();
  e.dialogWrong();
  ok(t.wordScore === 0, '\u063A\u0644\u0637 \u2192 wordScore=0');
  ok(e.total() === t.changeState + t.extraTimeState + t.wrongCounter, '\u062C\u0645\u0639 \u0628\u062F\u0648\u0646 \u0627\u0645\u062A\u06CC\u0627\u0632 \u06A9\u0644\u0645\u0647');
}

/* ---------- █╢) \u062E\u0637\u0627: 3 \u0628\u0627\u0631 \u2192 \u067E\u0627\u06CC\u0627\u0646 \u0641\u0648\u0631\u06CC ---------- */
section('\u0633\u0647 \u062E\u0637\u0627');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(70, 2);
  e.reveal(); e.run();
  ok(e.fault() === true && t.wrongCounter === -1, '\u062E\u0637\u0627 1');
  ok(e.fault() === true && t.wrongCounter === -2, '\u062E\u0637\u0627 2');
  ok(e.fault() === 'faultout' && t.wrongCounter === -3, '\u062E\u0637\u0627 3 \u2192 faultout');
  ok(t.wordScore === 0, '\u0627\u0645\u062A\u06CC\u0627\u0632 \u06A9\u0644\u0645\u0647 \u0635\u0641\u0631 \u0634\u062F');
  ok(!t.running && t.state === 4, '\u062A\u0627\u06CC\u0645\u0631 \u0645\u062A\u0648\u0642\u0641\u060C \u062F\u06CC\u0627\u0644\u0648\u06AF');
  ok(e.total() === t.changeState + t.extraTimeState - 3, '\u062C\u0645\u0639 \u0628\u0627 -3');
}

/* ---------- █╖) \u062A\u0639\u0648\u06CC\u0636 \u06A9\u0644\u0645\u0647 ---------- */
section('\u062A\u0639\u0648\u06CC\u0636 \u06A9\u0644\u0645\u0647');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(70, 2);
  const w1 = t.word;
  e.reveal();
  ok(e.change() === true && t.changeState === -1, '\u062A\u0639\u0648\u06CC\u0636 1 \u2192 -1');
  ok(t.word.text !== w1.text, '\u06A9\u0644\u0645\u0647 \u062C\u062F\u06CC\u062F');
  ok(t.wordScore === 2, '\u0627\u0645\u062A\u06CC\u0627\u0632 \u0647\u0645\u0627\u0646 \u0633\u0637\u062D \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0634\u062F');
  for (let i = 0; i < 5; i++) ok(e.change() === true, '\u062A\u0639\u0648\u06CC\u0634 \u0628\u06CC\u200C\u0645\u062D\u062F\u0648\u062F\u062A ' + (i + 2));
  ok(t.changeState === -6, '\u0645\u062C\u0645\u0648\u0639 \u062A\u0639\u0648\u06CC\u0636 = -6');
}
{
  /* \u062A\u0639\u0648\u06CC\u0636 \u0628\u0631\u0627\u06CC \u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B\u0644 20 \u0645\u0645\u0646\u0648\u0639 */
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(50, 20);
  e.reveal();
  ok(e.change() === false, '\u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B\u0644 20: \u062A\u0639\u0648\u06CC\u0636 \u0645\u0645\u0646\u0648\u0639');
  ok(e.extraTime() === true, '\u0632\u0645\u0627\u0646 \u0627\u0636\u0627\u0641\u0647 \u0627\u062C\u0627\u0632\u0647 (\u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B\u0644)');
  ok(t.timeLeft === 150 + 30, '+30 \u062B\u0627\u0646\u06CC\u0647 \u0631\u06CC\u0633\u062A \u06A9\u0627\u0645\u0644 (got ' + t.timeLeft + ')');
  ok(t.extraTimeState === -1, 'extraTimeState=-1');
}
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(70, 1);
  e.reveal();
  ok(e.extraTime() === false, '\u0632\u0645\u0627\u0646 \u0627\u0636\u0627\u0641\u0647 \u0641\u0642\u0637 \u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B\u0644');
}

/* ---------- █╕) \u0642\u0627\u0646\u0648\u0646 \u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B\u0644 20 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC ---------- */
section('\u0642\u0627\u0646\u0648\u0646 20 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u067E\u0631 \u062A\u06CC\u0645');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  e.startTurn(50, 20);
  e.reveal(); e.run();
  ok(e.team(0).proverbState === true, '\u0628\u0627 \u0634\u0631\u0648\u0639 \u06A9\u0644\u0645\u0647\u0654 20 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC\u060C \u062A\u06CC\u0645 \u0641\u0644\u06AF \u0645\u06CC\u200C\u062E\u0648\u0631\u062F');
  ok(e.team(1).proverbState === false, '\u062A\u06CC\u0645 \u062F\u06CC\u06AF\u0631 \u062A\u0627\u062B\u06CC\u0631 \u0646\u06AF\u0631\u0641\u062A');
}

/* ---------- █╣) \u062E\u0631\u0648\u062C\u06CC \u062A\u0631\u0627\u0646\u0647 \u0648 \u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B\u0644 ---------- */
section('\u062A\u0631\u0627\u0646\u0647 \u0648 \u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B\u0644');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(60, 5);
  ok(t.word && t.score === 5 && t.word.sub, '\u062A\u0631\u0627\u0646\u0647: \u0645\u062A\u0646 + \u062E\u0648\u0627\u0646\u0646\u062F\u0647\u060C \u0627\u0645\u062A\u06CC\u0627\u0632 5');
}
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(50, 4);
  ok(t.wordScore === 4, '\u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B\u0644 4 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC');
}

/* ---------- █▒█░) \u0645\u0648\u062F \u0633\u0631\u0639\u062A\u06CC ---------- */
section('\u0633\u0631\u0639\u062A\u06CC');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(40, 1);
  ok(t.speedList.length === 8, '\u0635\u0641 8 \u06A9\u0644\u0645\u0647\u200C\u0627\u06CC (got ' + t.speedList.length + ')');
  ok(t.speedList.every(x => x.word.score === 1), '\u0647\u0645\u0647 1 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC');
  e.reveal(); e.run();
  e.speedTrue();
  ok(t.speedIndex === 1 && t.speedList[0].right === true, '\u062F\u0631\u0633\u062A \u2192 \u06A9\u0644\u0645\u0647 \u0628\u0639\u062F\u06CC');
  e.speedChange();
  ok(t.speedIndex === 2 && !t.speedList[1].right, '\u0631\u062F \u0634\u062F\u0646 \u2192 \u06A9\u0644\u0645\u0647 \u0628\u0639\u062F\u06CC \u0628\u062F\u0648\u0646 \u0639\u0644\u0627\u0645\u062A');
  for (let i = t.speedIndex; i < 7; i++) e.speedTrue();
  const r = e.speedTrue();   // \u06A9\u0644\u0645\u0647 \u0647\u0634\u062A\u0645
  ok(r === 'dialog' && t.state === 4, '\u0627\u062A\u0645\u0627\u0645 \u0635\u0641 \u2192 \u062F\u06CC\u0627\u0644\u0648\u06AF');
  const sum = e.speedTotal();
  ok(sum === 7, '\u062C\u0645\u0639: 7 \u06A9\u0644\u0645\u0647 \u062F\u0631\u0633\u062A \u00D7 1 = 7 (got ' + sum + ')');
}
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(40, 99);
  ok(t.speedList.length === 80, '\u0646\u0627\u0645\u062D\u062F\u0648\u062F: 80 \u06A9\u0644\u0645\u0647 (got ' + t.speedList.length + ')');
  ok(t.stableTime === 180, '\u0632\u0645\u0627\u0646 180\u062B');
  e.reveal(); e.run();
  e.speedFault(); e.speedFault();
  const r = e.speedFault();
  ok(r === 'faultout', '3 \u062E\u0637\u0627 \u2192 \u067E\u0627\u06CC\u0627\u0646');
  ok(e.speedTotal() === -3, '\u062C\u0645\u0639 = -3');
}
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const t = e.startTurn(40, 2);
  e.reveal(); e.run();
  let r;
  for (let i = 0; i < 119; i++) e.tick();
  r = e.tick();                      // \u062A\u06CC\u06A9 \u06F1\u06F2\u06F0\u0645 = \u067E\u0627\u06CC\u0627\u0646 \u0632\u0645\u0627\u0646
  ok(r === 'timeout' && t.state === 4, '\u067E\u0627\u06CC\u0627\u0646 \u0632\u0645\u0627\u0646 \u0633\u0631\u0639\u062A\u06CC \u2192 \u062F\u06CC\u0627\u0644\u0648\u06AF');
}

/* ---------- █▒█▒) \u0686\u0631\u062E\u0634 \u0648 \u062F\u0648\u0631\u0647\u0627 \u0648 \u067E\u0627\u06CC\u0627\u0646 \u0628\u0627\u0632\u06CC ---------- */
section('\u0686\u0631\u062E\u0634 \u062A\u06CC\u0645\u200C\u0647\u0627\u060C \u062F\u0648\u0631\u0647\u0627\u060C \u067E\u0627\u06CC\u0627\u0646');
{
  const e = makeEngine(['A', 'B', 'C'], 3, 0);
  ok(e.roundNumber() === 1, '\u062F\u0631 \u0627\u0628\u062A\u062F\u0627 \u062F\u0648\u0631 1');
  ok(!e.isOver(), '\u0628\u0627\u0632\u06CC \u062A\u0645\u0627\u0645 \u0646\u0634\u062F\u0647');

  let turns = 0;
  while (!e.isOver() && turns < 30) {
    e.continueTurn();                       // Continue \u062F\u0631 \u0635\u0641\u062D\u0647 \u06AF\u0631\u0648\u0647
    const playing = e.turnIndex;            // \u062A\u06CC\u0645 \u0628\u0627\u0632\u06CC\u200C\u06A9\u0646\u0646\u062F\u0647
    const team = e.team(playing);
    const t = e.startTurn(70, 2);
    e.reveal(); e.run(); e.stop(); e.dialogRight();
    const total = e.commitTurn(e.total());
    turns++;
    if (total.type !== 'end') {
      ok(e.turnIndex === (playing + 1) % 3, '\u0646\u0648\u0628\u062A \u0628\u0639\u062F\u06CC \u062F\u0631\u0633\u062A \u0627\u0633\u062A');
    }
  }
  ok(turns === 9, '3 \u062A\u06CC\u0645 \u00D7 3 \u062F\u0648\u0631 = 9 \u0646\u0648\u0628\u062A (got ' + turns + ')');
  ok(e.teams.every(t => t.counter === 4), '\u0647\u0645\u0647 \u0634\u0645\u0627\u0631\u0646\u062F\u0647=4 (1 \u0627\u0648\u0644\u06CC\u0647 + 3 \u0646\u0648\u0628\u062A)');
  ok(e.teams[2].counter > e.rounds, '\u0642\u0627\u0646\u0648\u0646 \u067E\u0627\u06CC\u0627\u0646: \u0634\u0645\u0627\u0631\u0646\u062F\u0647\u0654 \u0622\u062E\u0631\u06CC\u0646 \u062A\u06CC\u0645 > \u062F\u0648\u0631\u0647\u0627');
  const s = e.commitTurn(0);
  ok(s.type === 'end' && e.finished, 'commit \u067E\u0633 \u0627\u0632 \u067E\u0627\u06CC\u0627\u0646 \u2192 end');
}
{
  /* \u062F\u0648\u0631 1 \u0628\u0627 3 \u062A\u06CC\u0645 \u2192 3 \u0646\u0648\u0628\u062A */
  const e = makeEngine(['A', 'B', 'C'], 1, 0);
  let turns = 0;
  while (!e.isOver() && turns < 10) {
    e.continueTurn();
    e.startTurn(70, 1); e.reveal(); e.run(); e.stop(); e.dialogRight();
    e.commitTurn(e.total());
    turns++;
  }
  ok(turns === 3, '\u062F\u0648\u0631 1 \u00D7 3 \u062A\u06CC\u0645 = 3 \u0646\u0648\u0628\u062A (got ' + turns + ')');
}
{
  /* \u0639\u0644\u0627\u0645\u062A \u0646\u0648\u0628\u062A \u0628\u0639\u062F\u06CC \u0648 \u0639\u0644\u0627\u0645\u062A position */
  const e = makeEngine(['A', 'B'], 3, 0);
  ok(e.team(0).position === true, '\u062A\u06CC\u0645 1 position');
  e.continueTurn();
  ok(e.team(0).position === false && e.team(1).position === true, '\u067E\u0633 \u0627\u0632 Continue \u0646\u0634\u0627\u0646 \u0645\u06CC\u200C\u0631\u0648\u062F \u0628\u0647 \u062A\u06CC\u0645 2');
  ok(e.team(0).counter === 2, '\u0634\u0645\u0627\u0631\u0646\u062F\u0647\u0654 \u062A\u06CC\u0645 1 = 2');
}

/* ---------- █▒█▓) \u062B\u0628\u062A \u0627\u0645\u062A\u06CC\u0627\u0632 \u0645\u0646\u0641\u06CC \u0648 \u062C\u0645\u0639 ---------- */
section('\u062B\u0628\u062A \u0627\u0645\u062A\u06CC\u0627\u0632');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  e.continueTurn();
  const t = e.startTurn(70, 2);
  e.reveal(); e.run();
  e.fault(); e.fault();            // -2 \u062E\u0637\u0627 (\u0646\u0647 3 \u062A\u0627)
  e.stop(); e.dialogWrong();       // \u063A\u0644\u0637 \u2192 0
  const total = e.total();
  ok(total === -2, '\u062C\u0645\u0639 = -2 (0 + 0 + 0 - 2) (got ' + total + ')');
  e.commitTurn(total);
  ok(e.team(0).score === -2, '\u0627\u0645\u062A\u06CC\u0627\u0632 \u062A\u06CC\u0645 = -2');
}

/* ---------- █▒█│) \u0627\u0633\u062A\u062E\u0631 \u06A9\u0644\u0645\u0647: \u0628\u062F\u0648\u0646 \u062A\u06A9\u0631\u0627\u0631 \u062A\u0627 \u062A\u0645\u0627\u0645 \u0634\u062F\u0646 ---------- */
section('\u0627\u0633\u062A\u062E\u0631 \u06A9\u0644\u0645\u0647');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const seen = new Set();
  const arr = data.adabazi['85'].filter(w => w[1] === 1);   // \u062F\u0633\u062A\u0647 \u06A9\u0648\u0686\u06A9
  const n = arr.length;
  let dup = false;
  for (let i = 0; i < n; i++) {
    const w = e.drawWord(85, 1);
    e.markUsed(85, w.text);
    if (!w) { dup = true; break; }
    if (seen.has(w.text)) { dup = true; break; }
    seen.add(w.text);
  }
  ok(!dup, '\u0628\u062F\u0648\u0646 \u062A\u06A9\u0631\u0627\u0631 \u062A\u0627 \u062A\u0645\u0627\u0645 \u0634\u062F\u0646 \u062F\u0633\u062A\u0647 (' + seen.size + ' \u06A9\u0644\u0645\u0647)');
  const w2 = e.drawWord(85, 1);
  ok(!!w2 && seen.has(w2.text), '\u0628\u0639\u062F \u0627\u0632 \u062A\u0645\u0627\u0645 \u0634\u062F\u0646 \u0631\u06CC\u0633\u062A \u0645\u06CC\u200C\u0634\u0648\u062F');
}

/* ---------- █▒█┤) \u062A\u0635\u0627\u062F\u0641\u06CC (cid 69) ---------- */
/* ---------- 14) \u062A\u0635\u0627\u062F\u0641\u06CC (cid 69) ---------- */
/* ---------- 14) \u062A\u0635\u0627\u062F\u0641\u06CC (cid 69) ΓÇö \u0645\u0633\u0642\u0644 \u0627\u0632 \u0627\u0646\u062A\u0628\u0627\u0628 \u062F\u0633\u062A\u0647\u06CC ---------- */
section('\u062F\u0633\u062A\u0647 \u062A\u0635\u0627\u062F\u0641\u06CC');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  /* \u06A9\u0644\u0645\u0647 \u062A\u0635\u0627\u062F\u0641\u06CC: \u0627\u0632 \u0647\u0645\u0647 \u062F\u0633\u062A\u0647 \u0648\u0644\u06CC \u0641\u0642\u0637 \u0628\u0627 \u0627\u0645\u062A\u06CC\u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A */
  const t = e.startTurn(69, 3);
  ok(t && t.word.cid !== 83, '\u062A\u0635\u0627\u062F\u0641\u06CC: \u062F\u0633\u062A\u0647 \u06A9\u0648\u062F\u06A9\u0627\u0646 (83) \u0645\u0633\u062A\u062B\u0646\u06CC');
  ok(t.word.cid >= 70 && t.word.cid <= 86, 'cid \u062F\u0631 \u0645\u062D\u062F\u0648\u062F\u0647 \u06A9\u0644\u0645\u0627\u062A (got ' + t.word.cid + ')');
  ok(t.word.score === 3, '\u062A\u0635\u0627\u062F\u0641\u06CC: \u0641\u0642\u0637 \u0628\u0627 \u0627\u0645\u062A\u06CC\u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC (got ' + t.word.score + ')');

  /* \u0627\u0633\u062A\u0642\u0644\u0627\u0646\u06CC: \u0627\u0646\u062A\u0628\u0627\u0628 \u062A\u0635\u0627\u062F\u0641\u06CC \u0646\u0628\u0627\u06CC\u062F \u0628\u0647\u0639\u0646\u0648\u062F \u0627\u0635\u0644\u0627\u062D\u06CC \u0646\u0645\u06CC\u0634\u0648\u062F */
  ok(e.isCardUsed(0, 69, 3) === false, '\u062A\u0635\u0627\u062F\u0641\u06CC \u0628\u0639\u0646\u0648\u0627\u0646\u062F \u0628\u0647\u0639\u0646\u0648\u062F \u062A\u062D\u062A\u06CC\u0631 \u0646\u0634\u062F \u0646\u0634\u062F');
  ok(JSON.stringify(e.teams[0].usedCards) === '{}', '\u062A\u0635\u0627\u062F\u0641\u06CC \u0647\u06CC\u0686 \u062F\u0631 \u0646\u0642\u0634\u0627\u0631 \u0627\u0646\u062A\u0628\u0627\u0628 \u062F\u0633\u062A\u0647 \u062B\u0628\u062A \u0646\u0634\u062F');

  /* \u0627\u0646\u062A\u0628\u0627\u0628 \u062A\u0635\u0627\u062F\u0641\u06CC \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u06CC\u200C\u0634\u0648\u062F \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u06CC\u200C\u0634\u0648\u062F */
  ok(e.startTurn(69, 3) !== null, '\u062A\u06CC\u0645 1: \u062A\u0635\u0627\u062F\u0641\u06CC \u062F\u0648\u0628\u0627\u0631\u0647 \u0645\u0645\u0646\u0648\u0639 (\u0645\u0633\u062A\u0642\u0644 \u0627\u0632 \u0627\u0646\u062A\u0628\u0627\u0628 \u062F\u0633\u062A\u0647\u06CC)');
  ok(e.startTurn(69, 2) !== null, '\u062A\u06CC\u0645 1: \u062A\u0635\u0627\u062F\u0641\u06CC \u0628\u0627 \u0627\u0645\u062A\u06CC\u0627\u0632 \u062F\u06CC\u06AF\u0631 \u0645\u0645\u0646\u0648\u0639');
  ok(JSON.stringify(e.teams[0].usedCards) === '{}', '\u0647\u06CC\u0686 \u062A\u0635\u0627\u062F\u0641\u06CC \u0647\u06CC\u0686 \u0644\u06CC\u0645\u06CC\u062A \u0627\u0632 \u0645\u062A\u06CC\u0627\u0632 \u062F\u0633\u062A\u0647\u06CC');

  /* \u0627\u0633\u062A\u0642\u0644\u0627\u0646\u06CC: \u0627\u0646\u062A\u0628\u0627\u0628 \u062A\u0635\u0627\u062F\u0641\u06CC \u0646\u0627\u0628\u0627\u06CC\u062F \u0645\u062D\u062F\u0648\u062F\u0647 \u062F\u0633\u062A\u0647\u06CC \u0631\u0627 \u062F\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F */
  const e2 = makeEngine(['A', 'B'], 3, 0);
  e2.startTurn(71, 3);          // \u062A\u06CC\u0645 1: \u062E\u0648\u0631\u0627\u06A9\u06CC 3 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC (\u062F\u0633\u062A\u0647\u06CC)
  e2.startTurn(69, 3);          // \u062A\u0635\u0627\u062F\u0641\u06CC \u0646\u0627\u0628\u0627\u06CC\u062F
  ok(e2.isCardUsed(0, 71, 3) === true, '\u062A\u0635\u0627\u062F\u0641\u06CC \u0645\u062D\u062F\u0648\u062F \u0627\u0646\u062A\u0628\u0627\u0628 \u062F\u0633\u062A\u0647\u06CC \u0631\u0627 \u062F\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F');
  ok(e2.isCardUsed(0, 69, 3) === false, '\u062A\u0635\u0627\u062F\u0641\u06CC \u0645\u062D\u062F\u0648\u062F \u0627\u0646\u062A\u0628\u0627\u0628 \u062F\u0633\u062A\u0647\u06CC \u0631\u0627 \u062F\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F');
  ok(e2.startTurn(71, 3) === null, '\u0645\u062D\u062F\u0648\u062F \u062F\u0633\u062A\u0647\u06CC \u062E\u0648\u0631\u0627\u06A9\u06CC 3 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u0647\u0645\u0686\u0646 \u0628\u0631\u0627\u064A \u0628\u0627\u0648\u0633\u062F');

  /* \u0627\u0633\u062A\u0642\u0644\u0627\u0646\u06CC \u0645\u0633\u062A\u0642\u0644: \u062A\u06CC\u0645 2 \u0645\u062A\u0627\u062B\u0644\u0633 \u0645\u062D\u062F\u0648\u062F \u0627\u0646\u062A\u0628\u0627\u0628 \u062E\u0648\u0631\u0627\u06A9\u06CC \u062F\u0627\u0631\u062F */
  const e3 = makeEngine(['A', 'B'], 3, 0);
  e3.startTurn(69, 3);
  e3.commitTurn(0);
  ok(e3.teams[0].usedCards && Object.keys(e3.teams[0].usedCards).length === 0, '\u0646\u0642\u0634\u0647\u0627\u0646 \u062A\u06CC\u0645 1 \u0628\u0639\u062F \u0627\u0632 \u062A\u0635\u0627\u062F\u0641\u06CC \u062E\u0627\u0644\u064A \u0628\u0648\u062F\u0647 \u0627\u0633');
  ok(e3.isCardUsed(1, 69, 3) === false, '\u062A\u06CC\u0645 2 \u0647\u0645 \u0646\u0633\u0642\u0644 \u0627\u0646\u062A\u0628\u0627\u0628 \u062A\u0635\u0627\u062F\u0641\u06CC');
}



/* ---------- █▒█╡) \u0628\u0648\u0645 ---------- */
/* ---------- 15) \u0628\u0648\u0645 (\u0645\u0637\u0627\u0628\u0642 BoomPlayFragment \u0627\u067e \u0627\u0635\u0644\u06cc) ---------- */
/* ---------- 15.5) \u0642\u0627\u0646\u0648\u0646 \u0627\u0646\u062A\u0628\u0627\u0628 \u06A9\u0627\u0631\u062A: \u0647\u0631 \u062A\u06CC\u0645\u060C \u0647\u0631 ┬½\u062F\u0633\u062A\u0647 + \u0627\u0645\u062A\u06CC\u0627\u0632┬╗ \u0641\u0642\u0637 \u06CC\u06A9\u200C\u0628\u0627\u0631 ---------- */
/* ---------- 15.5) \u0642\u0627\u0646\u0648\u0646 \u0627\u0646\u062A\u0628\u0627\u0628 \u06A9\u0627\u0631\u062A: \u0647\u0631 \u062A\u06CC\u0645\u060C \u0647\u0631 ┬½\u062F\u0633\u062A\u0647 + \u0627\u0645\u062A\u06CC\u0627\u0632┬╗ \u0641\u0642\u0637 \u06CC\u06A9\u200C\u0628\u0627\u0631 ---------- */
/* ---------- 15.9) \u0642\u0641\u0644 \u062A\u0639\u0648\u06CC\u0636 \u06A9\u0644\u0645\u0647 \u062F\u0631 \u062D\u06CC\u0646 \u062A\u0627\u06CC\u0645\u0631 ---------- */
section('\u0642\u0641\u0644 \u062A\u0639\u0648\u06CC\u0636 \u06A9\u0644\u0645\u0647');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  e.startTurn(70, 2);
  e.reveal();                       // state 2: \u062A\u0627\u06CC\u0645\u0631 \u0634\u0631\u0648\u0639 \u0646\u0634\u062F\u0647
  ok(e.change() === true, '\u062A\u0639\u0648\u06CC\u0636 \u062A\u0627\u06CC\u0645\u0631 \u0642\u0628\u0644 \u0627\u0632 \u0634\u0631\u0648\u0639 \u062A\u0627\u06CC\u0645\u0631 \u0645\u0645\u0646\u06CC');
  e.startTurn(70, 2);
  e.reveal(); e.run();             // state 3: \u062A\u0627\u06CC\u0645\u0631 \u062F\u0631 \u062C\u0627\u0631\u06CC\u0646
  ok(e.change() === false, '\u062D\u06CC\u0646 \u0627\u062C\u0631\u0627\u06CC \u062A\u0627\u06CC\u0645\u0631 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F \u06A9\u0644\u0645\u0647 \u0639\u0648\u0636 \u06A9\u0645\u06CC\u200C\u0634\u0648\u062F');
  ok(e.turn.changeState === -1, '\u062A\u0646\u0641\u0631 \u062F\u0631 \u062D\u06CC\u0646 \u062A\u0627\u06CC\u0645\u0631 \u062A\u0639\u0648\u06CC\u0636 \u0646\u0634\u062F');
}

section('\u0627\u0646\u062A\u0628\u0627\u0628 \u06A9\u0627\u0631\u062A');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  const cat71 = { cid: 71, score: 0, fa: '\u062E\u0648\u0631\u0627\u06A9\u06CC' };

  ok(JSON.stringify(e.cardOptions(cat71)) === '[1,2,3]', '\u062F\u0633\u062A\u0647\u064A \u06A9\u0644\u0645\u0647 \u2192 \u06AF\u0632\u06CC\u0646\u0647\u0627\u064A 1/2/3');
  ok(JSON.stringify(e.cardOptions({ cid: 40, score: 2 })) === '[2]', '\u062F\u0633\u062A\u0647\u064A \u0628\u0627 \u0627\u0645\u062A\u06CC\u0627\u0632 \u062B\u0627\u0628\u062A \u2192 \u0641\u0642\u0637 \u0647\u0645\u0627\u0646 \u0627\u0645\u062A\u06CC\u0627\u0632');

  /* \u062A\u06CC\u0645 1 \u06A9\u0627\u0631\u062A ┬½\u062E\u0648\u0631\u0627\u06A9\u06CC 3 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC┬╗ \u0631\u0627 \u0628\u0631\u0645\u06CC\u062F\u0627\u0631\u062F */
  const t1 = e.startTurn(71, 3);
  ok(!!t1, '\u062A\u06CC\u0645 1: \u062E\u0648\u0631\u0627\u06A9\u06CC 3 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u062F');
  ok(e.isCardUsed(0, 71, 3) === true, '\u06A9\u0644\u06CC\u062F ┬½71:3┬╗ \u0628\u0631\u0627\u06CC \u062A\u06CC\u0645 1 \u0642\u0641\u0644 \u0634\u062F');
  ok(e.isCardUsed(0, 71, 2) === false, '\u062E\u0648\u0631\u0627\u06A9\u06CC 2 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u0628\u0631\u0627\u06CC \u062A\u06CC\u0645 1 \u0647\u0646\u0648\u0632 \u0622\u0632\u0627\u062F \u0627\u0633\u062A');
  ok(e.isCardUsed(0, 71, 1) === false, '\u062E\u0648\u0631\u0627\u06A9\u06CC 1 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u0628\u0631\u0627\u06CC \u062A\u06CC\u0645 1 \u0647\u0646\u0648\u0632 \u0622\u0632\u0627\u062F \u0627\u0633\u062A');

  /* \u062A\u0627\u0632\u06CC\u0631 \u0645\u062C\u062F\u062F \u0647\u0645\u0627\u0646 \u06A9\u0627\u0631\u062A \u062F\u0631 \u0647\u0645\u06CC\u0646 \u0646\u0648\u0628\u062A \u062A\u06CC\u0645 1 \u0645\u0645\u0646\u0648\u0639 \u0627\u0633 */
  const again = e.startTurn(71, 3);
  ok(again === null, '\u062A\u06CC\u0645 1: \u0627\u0646\u062A\u0628\u0627\u0628 \u0645\u062C\u062F\u062F \u062E\u0648\u0631\u0627\u06A9\u06CC 3 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u0645\u0645\u0646\u0648\u0639 (null)');

  /* \u0627\u0633\u062A\u0642\u0644\u0627\u06CC\u06CC \u062F\u0648 \u062A\u06CC\u0645: \u0646\u0648\u0628\u062A \u0628\u0647 \u062A\u06CC\u0645 2 \u0645\u06CC\u200C\u0631\u0627\u06CC\u062F */
  e.commitTurn(0);
  const t2 = e.startTurn(71, 3);
  ok(!!t2, '\u062A\u06CC\u0645 2: \u062E\u0648\u0631\u0627\u06A9\u06CC 3 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u0645\u062C\u0627\u0632 \u0627\u0633\u0641 \u0646\u0633\u062A\u0639\u0646\u062F\u0647\u064A \u062A\u06CC\u0645\u200C\u0647\u0627');
  ok(e.isCardUsed(1, 71, 3) === true, '\u06A9\u0644\u06CC\u062F ┬½71:3┬╗ \u0628\u0631\u0627\u06CC \u062A\u06CC\u0645 2 \u0647\u0645 \u0642\u0641\u0644 \u0634\u062F');
  ok(e.isCardUsed(0, 71, 3) === true, '\u0642\u0641\u0644 \u062A\u06CC\u0645 1 \u0633\u0631 \u062C\u0627\u06CC\u0634\u06CC\u0634 \u0627\u0633\u062A');
}
{
  /* \u0647\u0631 \u0633\u0647 \u0627\u0645\u062A\u06CC\u0627\u0632 \u0628\u0639\u062F \u0627\u0632 \u0627\u0633\u0641\u0627\u062F\u0647 \u0642\u0641\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F */
  const e = makeEngine(['A', 'B'], 3, 0);
  e.startTurn(71, 3);
  e.startTurn(71, 2);
  e.startTurn(71, 1);
  ok(e.isCardUsed(0, 71, 1) && e.isCardUsed(0, 71, 2) && e.isCardUsed(0, 71, 3), '\u0647\u0631 \u0633\u0647 \u0627\u0645\u062A\u06CC\u0627\u0632 \u062E\u0648\u0631\u0627\u06A9\u06CC \u0628\u0631\u0627\u06CC \u062A\u06CC\u0645 1 \u0642\u0641\u0644 \u0634\u062F');
  ok(e.startTurn(71, 2) === null, '\u062F\u06CC\u06AF\u0631 \u0647\u06CC\u06A9 \u0627\u0645\u062A\u06CC\u0627\u0632 \u0627\u0632 \u062E\u0648\u0631\u0627\u06A9\u06CC \u0628\u0631\u0627\u06CC \u062A\u06CC\u0645 1 \u0642\u0627\u0628\u0644 \u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u06CC\u0633\u062A');
  e.commitTurn(0);
  ok(!!e.startTurn(71, 2), '\u062A\u06CC\u0645 2 \u0647\u0646\u0648\u0632 \u0645\u06CC\u062A\u0648\u0627\u0646\u062F \u062E\u0648\u0631\u0627\u06A9\u06CC 2 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u0631\u0627 \u0628\u06AF\u06CC\u0631\u062F');
}
{
  /* \u062F\u0633\u062A\u0647\u200C\u0647\u0627\u06CC \u0628\u0627 \u0627\u0645\u062A\u06CC\u0627\u0632 \u062B\u0627\u0628\u062A \u0647\u0645 \u0645\u0633\u0642\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F */
  const e = makeEngine(['A', 'B'], 3, 0);
  ok(!!e.startTurn(50, 2), '\u062A\u06CC\u0645 1: \u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B 2 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC');
  ok(e.startTurn(50, 2) === null, '\u062A\u06CC\u0645 1: \u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B 2 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u062F\u0648\u0628\u0627\u0631\u0647 \u0645\u0645\u0646\u0648\u0639');
  e.commitTurn(0);
  ok(!!e.startTurn(50, 2), '\u062A\u06CC\u0645 2: \u0636\u0631\u0628\u200C\u0627\u0644\u0645\u062B 2 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u0645\u062C\u0627\u0632');
  ok(!!e.startTurn(40, 1), '\u0633\u0631\u0639\u062A\u06CC 1 \u0627\u0645\u062A\u06CC\u0627\u0632\u06CC \u062C\u0627\u062F\u06AF\u0631 \u0642\u0641\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F (cid \u0645\u062A\u0641\u0627\u0648\u062A)');
}

section('\u0628\u0648\u0645');
{
  const e = makeEngine(['A', 'B'], 2, 5, 'boom');
  ok(e.startBoom(), '\u0628\u0648\u0645 \u0634\u0631\u0648\u0639');
  const b = e.boom;
  ok(b.state === 1 && b.player === 0, '\u0628\u0627\u0632\u06cc\u06a9\u0646 1 \u0634\u0631\u0648\u0639');
  ok(!!b.word, '\u06a9\u0644\u0645\u0647 \u0627\u0632 \u0627\u0628\u062a\u062f\u0627 \u0631\u0648\u06cc \u0635\u0641\u062d\u0647 \u062f\u06cc\u062f\u0647 \u0645\u06cc\u0634\u0648\u062f');
  const firstWord = b.word;

  e.boomClaim();
  ok(b.state === 2 && b.active === 0, '\u06af\u0631\u0641\u062a\u0646 \u06a9\u0644\u0645\u0647 \u2192 \u062d\u0627\u0644\u062a 2');
  ok(e.team(0).counter === 2, '\u0634\u0645\u0627\u0631\u0646\u062f\u0647 \u0628\u0627\u0632\u06cc\u06a9\u0646 1 = 2');
  ok(b.player === 1, '\u0646\u0648\u0628\u062a \u0628\u0639\u062f\u06cc \u2192 \u0628\u0627\u0632\u06cc\u06a9\u0646 2');

  e.boomRun();
  ok(b.running && b.timeLeft === 5, '\u062a\u0627\u06cc\u0645\u0631 5\u062b');
  b.timeLeft = 3;
  const gain = e.boomTrue();
  ok(gain === 4, '\u062f\u0631\u0633\u062a: \u062b\u0627\u0646\u06cc\u0647 \u0628\u0627\u0642\u06cc\u200c\u0645\u0627\u0646\u062f\u0647+1 = 4 (got ' + gain + ')');
  ok(e.team(0).score === 4, '\u0627\u0645\u062a\u06cc\u0627\u0632 \u062b\u0628\u062a \u0634\u062f');
  const nx = e.boomNext();
  ok(nx === 'next-word' && b.state === 1, '\u06a9\u0644\u0645\u0647 \u0628\u0639\u062f\u06cc');
  ok(b.word && b.word !== firstWord, '\u06a9\u0644\u0645\u0647 \u062c\u062f\u06cc\u062f \u0628\u0644\u0627 \u062a\u06a9\u0631\u0627\u0631');
  ok(b.timeLeft === 5, '\u062a\u0627\u06cc\u0645\u0631 \u06a9\u0644\u0645\u0647 \u0628\u0639\u062f\u06cc \u0631\u06cc\u0633\u062a \u0634\u062f');

  e.boomClaim();
  ok(b.active === 1, '\u06a9\u0644\u0645\u0647 \u062f\u0648\u0645 \u0628\u0631\u0627\u06cc \u0628\u0627\u0632\u06cc\u06a9\u0646 2');
  e.boomRun();
  e.boomFalse();
  ok(e.team(1).score === 0, '\u063a\u0644\u0637 = 0');
  e.boomNext();

  e.boomClaim(); e.boomRun(); e.boomTrue(); e.boomNext();
  e.boomClaim();
  ok(e.isOver(), '\u0622\u062e\u0631\u06cc\u0646 \u06a9\u0644\u0645\u0647 \u0628\u0627\u0632\u06cc\u06a9\u0646 2 \u062f\u0648\u0631 2 \u2192 finalRound');
  e.boomRun(); e.boomTrue();
  const end = e.boomNext();
  ok(end === 'end' && e.finished, '\u067e\u0627\u06cc\u0627\u0646 \u0628\u0627\u0632\u06cc \u0628\u0648\u0645');
}
{
  /* \u0628\u0627\u06af 1: \u062a\u0627\u06cc\u0645\u0631 \u0647\u0631 \u06a9\u0644\u0645\u0647 \u0628\u0627\u06cc\u062f \u0627\u0632 \u0646\u0648 \u0634\u0631\u0648\u0639 \u0634\u0648\u062f */
  const e = makeEngine(['A', 'B'], 3, 5, 'boom');
  e.startBoom();
  e.boomClaim(); e.boomRun();
  for (let i = 0; i < 4; i++) e.boomTick();
  ok(e.boom.timeLeft === 1, '1 \u062b\u0627\u0646\u06cc\u0647 \u0645\u0635\u0631\u0641 \u0634\u062f');
  e.boomTrue(); e.boomNext();
  e.boomClaim(); e.boomRun();
  ok(e.boom.timeLeft === 5 && e.boom.running, '\u0628\u0627\u06af \u0631\u0641\u0639 \u0634\u062f: \u062a\u0627\u06cc\u0645\u0631 \u06a9\u0644\u0645\u0647 \u0628\u0639\u062f\u06cc = 5\u062b \u0627\u0632 \u0646\u0648');
}
{
  /* \u0628\u0627\u06af 2: \u0628\u0639\u062f \u0627\u0632 \u067e\u0627\u06cc\u0627\u0646 \u0632\u0645\u0627\u0646\u060c \u062f\u0631\u0633\u062a \u0628\u0627\u06cc\u062f 1 \u0627\u0645\u062a\u06cc\u0627\u0632 \u0628\u062f\u0647\u062f */
  const e = makeEngine(['A', 'B'], 3, 5, 'boom');
  e.startBoom();
  e.boomClaim(); e.boomRun();
  let r;
  for (let i = 0; i < 5; i++) r = e.boomTick();
  ok(r === 'timeout' && !e.boom.running, '\u067e\u0627\u06cc\u0627\u0646 \u0632\u0645\u0627\u0646');
  ok(e.boom.timeout === true, '\u062d\u0627\u0644\u062a timeout (\u062f\u06a9\u0645\u0647 \u063a\u0644\u0637 \u0638\u0627\u0647\u0631 \u0645\u06cc\u0634\u0648\u062f)');
  ok(e.boom.state === 3, '\u0646\u0648\u0628\u062a \u0647\u0646\u0648\u0632 \u0628\u0627\u0632 \u0627\u0633\u062a');
  const g = e.boomTrue();
  ok(g === 1 && e.team(0).score === 1, '\u0628\u0639\u062f \u0627\u0632 \u067e\u0627\u06cc\u0627\u0646 \u0632\u0645\u0627\u0646: \u062f\u0631\u0633\u062a = 1 \u0627\u0645\u062a\u06cc\u0627\u0632 (got ' + g + ')');
}
{
  /* \u0628\u0639\u062f \u0627\u0632 \u067e\u0627\u06cc\u0627\u0646 \u0632\u0645\u0627\u0646\u060c \u063a\u0644\u0637 = \u0635\u0641\u0631 \u0627\u0645\u062a\u06cc\u0627\u0632 */
  const e = makeEngine(['A', 'B'], 3, 5, 'boom');
  e.startBoom();
  e.boomClaim(); e.boomRun();
  for (let i = 0; i < 5; i++) e.boomTick();
  e.boomFalse();
  ok(e.team(0).score === 0, '\u063a\u0644\u0637 = 0 \u0627\u0645\u062a\u06cc\u0627\u0632');
  ok(e.boom.state === 4, '\u0646\u0648\u0628\u062a \u0628\u0633\u062a\u0647 \u0634\u062f');
}

section('\u0645\u062A\u0646 \u0627\u0634\u062A\u0631\u0627\u06A9');
{
  const e = makeEngine(['A', 'B'], 3, 0);
  e.team(0).score = 10; e.team(1).score = -2;
  const txt = e.shareText();
  ok(txt.indexOf('\u062F\u0648\u0631 \u0628\u0627\u0632\u06CC') > 0, '\u0627\u0628\u062A\u062F\u0627\u06CC \u0645\u062A\u0646');
  ok(txt.indexOf('\u0645\u0642\u0627\u0645 \u0627\u0648\u0644') > 0 && txt.indexOf('\u0645\u0642\u0627\u0645 \u062F\u0648\u0645') > 0, '\u0631\u062A\u0628\u0647\u200C\u0647\u0627');
  ok(txt.indexOf('2-') > 0, '\u0627\u0645\u062A\u06CC\u0627\u0632 \u0645\u0646\u0641\u06CC \u0628\u0627 \u0639\u0644\u0627\u0645\u062A \u062F\u0631 \u067E\u0627\u0633');
}

console.log('\n========================================');
console.log(' PASS: ' + pass + '   FAIL: ' + fail);
console.log('========================================');
process.exit(fail ? 1 : 0);
