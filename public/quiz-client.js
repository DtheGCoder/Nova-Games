/* =======================================================================
   NOVA QUIZ — client. Lobby · Wager · Question · Reveal · Gameover.
   Uses window.NOVA (shared socket + utilities from app.js).
   ======================================================================= */
(() => {
'use strict';
const N = window.NOVA;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ic = n => N.ICON.get(n);
const fmt = N.fmt, esc = N.esc, toast = N.toast, Sound = N.Sound, FX = N.FX, vibrate = N.vibrate;

const CATS = [
  ['mixed', 'Gemischt'], ['allgemein', 'Allgemeinwissen'], ['geschichte', 'Geschichte'],
  ['geografie', 'Geografie'], ['wissenschaft', 'Wissenschaft'], ['technik', 'Technik & IT'],
  ['sport', 'Sport'], ['musik', 'Musik'], ['film', 'Film & TV'], ['kunst', 'Kunst & Literatur'],
  ['natur', 'Natur & Tiere'], ['essen', 'Essen & Trinken'], ['aktuelles', 'Aktuelles'],
  ['gaming', 'Gaming'], ['mathe', 'Mathe & Logik'],
];

let socket = null;
const Q = {
  code: null, me: null, room: null, timerRAF: null,
  enter: { mode: 'cash', buyIn: 1000, cat: 'mixed', diff: 'mixed', rounds: 10 },
  fiftyRemoved: [], lastResultRound: -1,
};

/* ============================ SOCKET BIND ============================ */
function bindSocket(s) {
  socket = s;
  s.on('quiz:state', (room) => { try { Q.room = room; Q.code = room.code; render(); } catch (e) { console.error('QUIZ render error:', e && e.message, e && e.stack); } });
  s.on('quiz:fx', onFx);
}

/* ============================ ENTER MODAL ============================ */
const BUYINS = [500, 1000, 2500, 5000];
function openEnter() {
  Q.enter = { mode: 'cash', buyIn: 1000, cat: 'mixed', diff: 'mixed', rounds: 10 };
  // category select
  const sel = $('#q-cat-sel'); sel.innerHTML = CATS.map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
  // buyin seg
  const seg = $('#q-buyin-seg'); seg.innerHTML = '';
  BUYINS.forEach(v => { const b = document.createElement('button'); b.textContent = fmt(v); if (v === Q.enter.buyIn) b.classList.add('on'); b.onclick = () => { Q.enter.buyIn = v; $$('#q-buyin-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on'); Sound.button(); }; seg.appendChild(b); });
  $$('.mode-opt[data-qmode]').forEach(b => b.classList.toggle('active', b.dataset.qmode === 'cash'));
  $('#q-buyin-row').classList.add('hidden');
  $$('#q-diff-seg button').forEach(b => b.classList.toggle('on', b.dataset.d === 'mixed'));
  $$('#q-rounds-seg button').forEach(b => b.classList.toggle('on', b.dataset.r === '10'));
  $('#q-enter-error').textContent = '';
  $('#modal-quiz-enter').classList.add('open'); Sound.button();
}
$$('.mode-opt[data-qmode]').forEach(b => b.addEventListener('click', () => {
  Q.enter.mode = b.dataset.qmode; $$('.mode-opt[data-qmode]').forEach(x => x.classList.toggle('active', x === b));
  $('#q-buyin-row').classList.toggle('hidden', Q.enter.mode !== 'tournament'); Sound.button();
}));
$('#q-cat-sel').addEventListener('change', e => Q.enter.cat = e.target.value);
$$('#q-diff-seg button').forEach(b => b.addEventListener('click', () => { Q.enter.diff = b.dataset.d; $$('#q-diff-seg button').forEach(x => x.classList.toggle('on', x === b)); Sound.button(); }));
$$('#q-rounds-seg button').forEach(b => b.addEventListener('click', () => { Q.enter.rounds = +b.dataset.r; $$('#q-rounds-seg button').forEach(x => x.classList.toggle('on', x === b)); Sound.button(); }));

$('#q-create').addEventListener('click', () => {
  Sound.button();
  const settings = { mode: Q.enter.mode, buyIn: Q.enter.buyIn, category: Q.enter.cat, difficulty: Q.enter.diff, totalRounds: Q.enter.rounds };
  socket.emit('quiz:create', { settings }, res => {
    if (res && res.ok) { Q.me = res.playerId; enterQuiz(); $('#modal-quiz-enter').classList.remove('open'); }
    else $('#q-enter-error').textContent = (res && res.message) || 'Konnte Raum nicht erstellen';
  });
});
$('#q-join').addEventListener('click', joinQuiz);
$('#q-join-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinQuiz(); });
function joinQuiz() {
  Sound.button();
  const code = $('#q-join-code').value.trim().toUpperCase();
  if (code.length !== 4) { $('#q-enter-error').textContent = 'Code = 4 Zeichen'; return; }
  socket.emit('quiz:join', { code }, res => {
    if (res && res.ok) { Q.me = res.playerId; enterQuiz(); $('#modal-quiz-enter').classList.remove('open'); if (res.spectator) toast('Zuschauer – nächste Runde dabei', '', false, 'eye'); }
    else { const m = { no_room: 'Raum nicht gefunden', full: 'Raum voll', already_in: 'Schon im Raum', broke: 'Zu wenig Geld' }; $('#q-enter-error').textContent = (res && (m[res.error] || res.message)) || 'Fehlgeschlagen'; }
  });
}
function enterQuiz() { N.showScreen('screen-quiz'); $('#q-chat-fab').style.display = 'none'; if (Q.room) render(); }

/* ============================ HELPERS ============================ */
function myP() { return Q.room ? Q.room.players.find(p => p.id === Q.me) : null; }

/* ============================ RENDER ============================ */
function render() {
  const room = Q.room; if (!room) return;
  $('#q-code').textContent = room.code;
  const badge = $('#q-mode-badge'); badge.className = 'mode-badge ' + room.mode; badge.textContent = room.mode === 'tournament' ? 'TURNIER' : 'FREI';
  $('#q-round').textContent = room.round; $('#q-total').textContent = room.totalRounds;

  // category chip
  const chip = $('#q-cat-chip');
  if (room.question && (room.phase === 'wager' || room.phase === 'question' || room.phase === 'reveal')) {
    chip.style.display = 'flex';
    chip.style.color = room.question.color;
    chip.innerHTML = `<span class="ci">${ic(room.question.icon || 'star')}</span>${esc(room.question.category)}`;
  } else chip.style.display = 'none';

  // panels
  showPanel(room.phase);
  if (room.phase === 'lobby') renderLobby(room);
  else if (room.phase === 'wager') renderWager(room);
  else if (room.phase === 'question') renderPlay(room, false);
  else if (room.phase === 'reveal') renderPlay(room, true);
  else if (room.phase === 'gameover') renderGameover(room);

  renderPlayers(room);
  renderTimer(room);
}
function showPanel(phase) {
  const map = { lobby: 'q-lobby', wager: 'q-wager', question: 'q-play', reveal: 'q-play', gameover: 'q-gameover' };
  const want = map[phase] || 'q-lobby';
  ['q-lobby', 'q-wager', 'q-play', 'q-gameover'].forEach(id => $('#' + id).classList.toggle('hidden', id !== want));
  $('#q-progress').style.visibility = (phase === 'lobby' || phase === 'gameover') ? 'hidden' : 'visible';
  $('#q-timerbar').style.visibility = (phase === 'lobby' || phase === 'gameover') ? 'hidden' : 'visible';
}

function renderLobby(room) {
  const me = myP();
  $('#q-lobby-pot').innerHTML = room.mode === 'tournament' ? `<span class="mini-icon">${ic('coins')}</span> Pot ${fmt(room.prizePool)}` : '';
  const lp = $('#q-lobby-players'); lp.innerHTML = '';
  room.players.forEach(p => { const c = document.createElement('div'); c.className = 'lobby-chip' + (p.anted || room.mode === 'cash' ? ' ready' : ''); c.innerHTML = `${p.isHost ? `<span class="crown">${ic('crown')}</span>` : ''}${esc(p.name)}${p.spectator ? ' 👁' : ''}`; lp.appendChild(c); });
  const isHost = me && me.isHost;
  $('#q-start').classList.toggle('hidden', !isHost);
  $('#q-settings-open').classList.toggle('hidden', !isHost);
  $('#q-lobby-wait').textContent = isHost ? 'Starte, wenn alle bereit sind' : 'Warte auf Host…';
}

function renderWager(room) {
  const me = myP(); if (!me) return;
  const cat = room.question;
  $('#q-wager-cat').style.setProperty('--cat', cat.color);
  $('#q-wager-cat').innerHTML = `<span class="rc-ic">${ic(cat.icon || 'star')}</span><span class="rc-name">${esc(cat.category)}</span><span class="rc-diff d${cat.difficulty}">${esc(cat.difficultyLabel)}</span>`;
  if (me.spectator || me.eliminated) {
    $('#q-wager-title') && ($('.q-wager-title').textContent = me.eliminated ? 'Ausgeschieden' : 'Zuschauer');
  }
  const minW = Math.min(room.settings.minBet, me.chips);
  const maxW = Math.min(room.settings.maxBet, me.chips);
  const sl = $('#q-wager-slider');
  sl.min = minW; sl.max = Math.max(minW, maxW); sl.value = me.wager || minW;
  $('#q-wager-val').textContent = fmt(me.wager || minW);
  $('#q-wager-bal').textContent = fmt(me.chips);
  // quick buttons
  const quick = $('#q-wager-quick'); quick.innerHTML = '';
  const opts = [['Min', minW], ['25%', Math.max(minW, Math.round(me.chips * .25))], ['50%', Math.max(minW, Math.round(me.chips * .5))], ['Max', maxW]];
  opts.forEach(([lbl, val]) => { const b = document.createElement('button'); if (lbl === 'Max') b.className = 'allin'; b.textContent = lbl; b.onclick = () => setWager(Math.min(val, maxW)); quick.appendChild(b); });
  // double powerup
  const dW = $('#q-pu-double-w');
  dW.classList.toggle('hidden', !room.settings.powerups);
  dW.classList.toggle('armed', me.doubleActive);
  $('#q-pu-double-w-n').textContent = me.doubleActive ? '✓' : (me.powerups ? me.powerups.double : 0);
  dW.disabled = me.doubleActive || !me.powerups || me.powerups.double <= 0 || me.spectator || me.eliminated;
}
function setWager(v) {
  const me = myP(); if (!me) return;
  const minW = Math.min(Q.room.settings.minBet, me.chips), maxW = Math.min(Q.room.settings.maxBet, me.chips);
  v = Math.max(minW, Math.min(maxW, Math.round(v)));
  $('#q-wager-slider').value = v; $('#q-wager-val').textContent = fmt(v);
  socket.emit('quiz:wager', { amount: v }); Sound.chip(); vibrate(6);
}
$('#q-wager-slider').addEventListener('input', e => { $('#q-wager-val').textContent = fmt(+e.target.value); });
$('#q-wager-slider').addEventListener('change', e => setWager(+e.target.value));
$('#q-pu-double-w').addEventListener('click', () => { socket.emit('quiz:powerup', { type: 'double' }); Sound.chip(); });

function renderPlay(room, reveal) {
  const me = myP();
  $('#q-text').textContent = room.question.q || '';
  const grid = $('#q-options');
  // rebuild options only when question text changes
  if (grid._q !== room.question.q) {
    grid._q = room.question.q; grid.innerHTML = '';
    (room.question.options || []).forEach((opt, i) => {
      const b = document.createElement('button'); b.className = 'q-opt'; b.dataset.i = i;
      b.innerHTML = `<span class="ol">${'ABCD'[i]}</span><span class="ot">${esc(opt)}</span><span class="mark ok">${ic('check')}</span><span class="mark no">${ic('close')}</span>`;
      b.onclick = () => answer(i);
      grid.appendChild(b);
    });
    // apply any active 50:50 for this question
    Q.fiftyRemoved.forEach(i => { const el = grid.querySelector(`.q-opt[data-i="${i}"]`); if (el) el.classList.add('removed'); });
  }
  const myAnswer = reveal ? me && me.answer : (me && me.locked ? me.answer : -1);
  $$('.q-opt', grid).forEach(b => {
    const i = +b.dataset.i;
    b.classList.toggle('picked', myAnswer === i && (reveal ? true : me && me.locked));
    if (reveal) {
      b.classList.add('locked');
      b.classList.toggle('correct', i === room.question.answer);
      b.classList.toggle('wrong', i !== room.question.answer);
    } else {
      b.classList.remove('correct', 'wrong');
      b.classList.toggle('locked', !!(me && me.locked) || me && (me.spectator || me.eliminated));
    }
  });
  // powerups visible only during question, before lock
  const showPU = !reveal && me && !me.locked && !me.spectator && !me.eliminated && room.settings.powerups;
  $('#q-powerups').style.display = 'flex';
  $('#q-pu-fifty').style.display = room.settings.powerups ? '' : 'none';
  $('#q-pu-double').style.display = room.settings.powerups ? '' : 'none';
  if (me) {
    $('#q-pu-fifty-n').textContent = me.powerups ? me.powerups.fifty : 0;
    $('#q-pu-double-n').textContent = me.doubleActive ? '✓' : (me.powerups ? me.powerups.double : 0);
    $('#q-pu-fifty').disabled = !showPU || !me.powerups || me.powerups.fifty <= 0;
    $('#q-pu-double').disabled = reveal || !me.powerups || me.powerups.double <= 0 || me.doubleActive || me.locked || me.spectator || me.eliminated;
    $('#q-pu-double').classList.toggle('armed', me.doubleActive);
    $('#q-play-wager').textContent = fmt(me.wager || 0);
  }
  // result banner
  const res = $('#q-result');
  if (reveal && me && !me.spectator && me.roundDelta !== undefined && Q.lastResultRound !== room.round) {
    // keep showing
  }
  if (reveal && me && !me.spectator && !me.eliminated) {
    res.classList.add('show');
    if (me.correct) { res.className = 'q-result show win'; res.innerHTML = `+${fmt(me.roundDelta)} <small>Richtig!${me.streak >= 2 ? ' 🔥 Serie ' + me.streak : ''}</small>`; }
    else { res.className = 'q-result show lose'; res.innerHTML = `${fmt(me.roundDelta)} <small>${me.answer < 0 ? 'Keine Antwort' : 'Leider falsch'}</small>`; }
  } else { res.className = 'q-result'; res.innerHTML = ''; }
}
function answer(i) {
  const me = myP(); if (!me || me.locked || Q.room.phase !== 'question' || me.spectator || me.eliminated) return;
  if (Q.fiftyRemoved.includes(i)) return;
  socket.emit('quiz:answer', { index: i }); Sound.button(); vibrate(12);
}
$('#q-pu-fifty').addEventListener('click', () => { socket.emit('quiz:powerup', { type: 'fifty' }); Sound.button(); });
$('#q-pu-double').addEventListener('click', () => { socket.emit('quiz:powerup', { type: 'double' }); Sound.chip(); });

function renderGameover(room) {
  const w = room.winner || {};
  $('#q-win-name').textContent = w.name || 'Niemand';
  $('#q-win-pot').innerHTML = room.mode === 'tournament' && w.pool ? `<span class="mini-icon">${ic('coins')}</span> ${fmt(w.pool)} gewonnen` : 'Gut gespielt!';
  const rk = $('#q-ranking'); rk.innerHTML = '';
  (w.ranking || []).forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'q-rank-row rank-' + (i + 1);
    const medal = ['🥇', '🥈', '🥉'][i] || (i + 1);
    row.innerHTML = `<div class="r">${medal}</div><div class="n">${esc(p.name)}<small>${p.correct} richtig · beste Serie ${p.best}</small></div><div class="c"><span class="mini-icon">${ic('coins')}</span>${fmt(p.chips)}</div>`;
    rk.appendChild(row);
  });
}

function renderPlayers(room) {
  const strip = $('#q-players'); const ids = room.players.map(p => p.id);
  $$('.qp', strip).forEach(el => { if (!ids.includes(el.dataset.pid)) el.remove(); });
  const lead = [...room.players].filter(p => !p.eliminated && !p.spectator).sort((a, b) => b.chips - a.chips)[0];
  room.players.forEach(p => {
    let el = $(`.qp[data-pid="${p.id}"]`, strip);
    if (!el) { el = document.createElement('div'); el.dataset.pid = p.id; strip.appendChild(el); }
    el.className = 'qp' + (p.id === Q.me ? ' me' : '') + (p.locked && room.phase === 'question' ? ' locked-in' : '') + (p.eliminated ? ' eliminated' : '') + (lead && p.id === lead.id && !p.eliminated ? ' lead' : '');
    el.innerHTML =
      `<div class="qp-av">${esc(p.name[0].toUpperCase())}</div>` +
      `<div class="qp-name">${esc(p.name)}</div>` +
      `<div class="qp-chips">${fmt(p.chips)}</div>` +
      (p.streak >= 2 ? `<div class="qp-streak">🔥${p.streak}</div>` : '') +
      `<span class="qp-lock">${ic('check')}</span>` +
      (p.spectator ? '<div class="qp-streak" style="background:rgba(255,255,255,.2)">👁</div>' : '');
    // reveal delta pop
    if (room.phase === 'reveal' && p.roundDelta && el._dr !== room.round) {
      el._dr = room.round;
      const d = document.createElement('div'); d.className = 'qp-delta ' + (p.roundDelta > 0 ? 'plus' : 'minus');
      d.textContent = (p.roundDelta > 0 ? '+' : '') + fmt(p.roundDelta); el.appendChild(d); setTimeout(() => d.remove(), 1600);
    }
  });
}

/* ============================ TIMER ============================ */
function renderTimer(room) {
  const total = room.phase === 'wager' ? room.settings.wagerTime : room.phase === 'question' ? room.settings.questionTime : room.phase === 'reveal' ? 5 : 0;
  const fill = $('#q-timerfill'), num = $('#q-timer-num');
  if (!total || !room.timerEndsAt) { num.textContent = ''; if (Q.timerRAF) { cancelAnimationFrame(Q.timerRAF); Q.timerRAF = null; } return; }
  const drift = room.serverNow - Date.now();
  const tick = () => {
    const remain = Math.max(0, room.timerEndsAt - (Date.now() + drift));
    const frac = Math.min(1, remain / (total * 1000));
    fill.style.width = (frac * 100) + '%';
    fill.className = 'q-timerfill' + (frac < .25 ? ' danger' : frac < .5 ? ' warn' : '');
    num.textContent = room.phase === 'reveal' ? '' : Math.ceil(remain / 1000);
    if (remain > 0) Q.timerRAF = requestAnimationFrame(tick);
  };
  if (Q.timerRAF) cancelAnimationFrame(Q.timerRAF); tick();
}

/* ============================ FX ============================ */
function onFx(e) {
  switch (e.type) {
    case 'matchStart': toast('Quiz startet!', 'gold', true, 'bolt'); FX.rain(); break;
    case 'wagerOpen': Q.fiftyRemoved = []; Sound.turn(); break;
    case 'questionStart': Sound.deal(); break;
    case 'reveal': revealFx(); break;
    case 'locked': toast('Antwort gesperrt', 'good', false, 'check'); break;
    case 'doubleArmed': toast('2× aktiv – doppelter Einsatz!', 'gold', false, 'bolt'); break;
    case 'fifty': Q.fiftyRemoved = e.remove || []; applyFifty(); Sound.button(); break;
    case 'eliminated': Sound.lose(); toast((e.playerId === Q.me ? 'Du bist' : e.name) + ' ausgeschieden', 'bad', e.playerId === Q.me, 'skull'); break;
    case 'gameOver': gameoverFx(e); break;
    case 'playerJoined': toast(e.name + ' ist dabei', 'good', false, 'user'); break;
    case 'playerLeft': toast(e.name + ' hat verlassen', ''); break;
    case 'settingsUpdated': toast('Einstellungen geändert', '', false, 'settings'); break;
    case 'emote': onEmote(e.playerId, e.emoji); break;
  }
}
function applyFifty() { const grid = $('#q-options'); Q.fiftyRemoved.forEach(i => { const el = grid.querySelector(`.q-opt[data-i="${i}"]`); if (el) el.classList.add('removed'); }); }
function revealFx() {
  const me = myP();
  if (me && !me.spectator && !me.eliminated) {
    if (me.correct) { Sound.win(); vibrate([20, 40, 20]); if (me.roundDelta > 0) FX.burst(innerWidth / 2, innerHeight / 2, 50); }
    else { Sound.lose(); vibrate(100); }
  }
}
function gameoverFx(e) {
  Sound.fanfare(); FX.rain();
  const won = e.winner && N.account && e.winner === N.account.username;
  if (won) { setTimeout(() => FX.burst(innerWidth / 2, innerHeight / 2, 90), 300); vibrate([40, 60, 40, 60, 120]); }
  setTimeout(() => N.refreshMe && N.refreshMe(), 800);
}
function onEmote(playerId, name) { const el = $(`.qp[data-pid="${playerId}"]`); if (!el) return; const b = document.createElement('div'); b.className = 'qp-emote'; b.innerHTML = N.ICON.emote(name); el.appendChild(b); setTimeout(() => b.remove(), 3200); }

/* ============================ CONTROLS ============================ */
$('#q-start').addEventListener('click', () => { socket.emit('quiz:start'); Sound.button(); });
$('#q-leave').addEventListener('click', () => { if (confirm('Quiz verlassen?')) { socket.emit('quiz:leave'); Q.room = null; Q.me = null; N.showScreen('screen-hub'); setTimeout(() => { N.refreshMe(); N.loadHub(); }, 400); } });
$('#q-copy').addEventListener('click', () => { const code = Q.room && Q.room.code; if (!code) return; const url = location.origin + '/#Q' + code; if (navigator.clipboard) navigator.clipboard.writeText(url); toast('Link kopiert!', 'good', false, 'copy'); Sound.button(); });
$('#q-board-btn').addEventListener('click', () => { openBoard(); Sound.button(); });

function openBoard() {
  const room = Q.room; if (!room) return; const body = $('#qboard-body'); body.innerHTML = '';
  [...room.players].sort((a, b) => b.chips - a.chips).forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'board-row rank-' + (i + 1) + (p.id === Q.me ? ' me' : '');
    const medal = i < 3 ? `<span class="medal">${ic('medal')}</span>` : (i + 1);
    row.innerHTML = `<div class="board-rank">${medal}</div><div class="board-name">${esc(p.name)}${p.id === Q.me ? ' (Du)' : ''}${p.eliminated ? ' · RAUS' : ''}<small>${p.correctCount} richtig</small></div><div class="board-chips"><span class="mini-icon">${ic('coins')}</span>${fmt(p.chips)}</div>`;
    body.appendChild(row);
  });
  $('#modal-qboard').classList.add('open');
}

/* settings modal (host) */
const QSET_SCHEMA = [
  { key: 'totalRounds', label: 'Anzahl Fragen', type: 'num', min: 3, max: 30 },
  { key: 'questionTime', label: 'Zeit pro Frage (Sek.)', type: 'num', min: 8, max: 40 },
  { key: 'wagerTime', label: 'Einsatz-Zeit (Sek.)', type: 'num', min: 4, max: 20 },
  { key: 'minBet', label: 'Min. Einsatz', type: 'num', min: 1, max: 100000 },
  { key: 'maxBet', label: 'Max. Einsatz', type: 'num', min: 1, max: 1000000 },
  { key: 'maxPlayers', label: 'Max. Spieler', type: 'num', min: 1, max: 10 },
  { key: 'powerups', label: 'Power-ups (50:50, 2×)', type: 'toggle' },
];
let qDraft = null;
$('#q-settings-open').addEventListener('click', () => {
  const room = Q.room; if (!room) return; qDraft = { ...room.settings };
  const body = $('#qsettings-body'); body.innerHTML = '';
  QSET_SCHEMA.forEach(f => {
    const row = document.createElement('div'); row.className = 'set-row';
    row.innerHTML = `<div><label>${f.label}</label></div>`;
    const ctrl = document.createElement('div'); ctrl.className = 'set-control';
    if (f.type === 'num') { const inp = document.createElement('input'); inp.type = 'number'; inp.className = 'num-input'; inp.value = qDraft[f.key]; inp.min = f.min; inp.max = f.max; inp.oninput = () => qDraft[f.key] = parseInt(inp.value, 10) || f.min; ctrl.appendChild(inp); }
    else { const tg = document.createElement('div'); tg.className = 'toggle' + (qDraft[f.key] ? ' on' : ''); tg.onclick = () => { qDraft[f.key] = !qDraft[f.key]; tg.classList.toggle('on', qDraft[f.key]); }; ctrl.appendChild(tg); }
    row.appendChild(ctrl); body.appendChild(row);
  });
  $('#modal-qsettings').classList.add('open'); Sound.button();
});
$('#q-save-settings').addEventListener('click', () => { socket.emit('quiz:settings', qDraft); $('#modal-qsettings').classList.remove('open'); Sound.button(); });

/* emotes */
$('#q-emote-fab').addEventListener('click', () => { $('#q-emote-popup').classList.toggle('open'); Sound.button(); });
(function buildEmotes() { const pop = $('#q-emote-popup'); pop.innerHTML = ''; N.ICON.EMOTE_LIST.forEach(name => { const b = document.createElement('button'); b.innerHTML = N.ICON.emote(name); b.onclick = () => { socket.emit('quiz:emote', { emoji: name }); pop.classList.remove('open'); vibrate(8); }; pop.appendChild(b); }); })();

$$('[data-close]').forEach(b => b.addEventListener('click', () => { const el = $('#' + b.dataset.close); if (el) el.classList.remove('open'); }));

window.NOVAQuiz = { bindSocket, openEnter };
})();
