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
  enter: { mode: 'cash', buyIn: 1000, cat: 'mixed', diff: 'mixed', rounds: 10, qtype: 'mixed' },
  fiftyRemoved: [], lastResultRound: -1, myFound: [], listRound: -1,
};

/* ============================ SOCKET BIND ============================ */
function bindSocket(s) {
  socket = s;
  s.on('quiz:state', (room) => {
    Q.room = room; Q.code = room.code; Q._drift = room.serverNow - Date.now();
    ensureTimerLoop();                       // timer runs independently of render()
    try { render(); } catch (e) { console.error('QUIZ render error:', e && e.message, e && e.stack); }
  });
  s.on('quiz:fx', onFx);
}

/* ============================ ENTER MODAL ============================ */
const BUYINS = [500, 1000, 2500, 5000];
function openEnter() {
  Q.enter = { mode: 'cash', buyIn: 1000, cat: 'mixed', diff: 'mixed', rounds: 10, qtype: 'mixed' };
  // category select
  const sel = $('#q-cat-sel'); sel.innerHTML = CATS.map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
  // buyin seg
  const seg = $('#q-buyin-seg'); seg.innerHTML = '';
  BUYINS.forEach(v => { const b = document.createElement('button'); b.textContent = fmt(v); if (v === Q.enter.buyIn) b.classList.add('on'); b.onclick = () => { Q.enter.buyIn = v; $$('#q-buyin-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on'); Sound.button(); }; seg.appendChild(b); });
  $$('.mode-opt[data-qmode]').forEach(b => b.classList.toggle('active', b.dataset.qmode === 'cash'));
  $('#q-buyin-row').classList.add('hidden');
  $$('#q-diff-seg button').forEach(b => b.classList.toggle('on', b.dataset.d === 'mixed'));
  $$('#q-rounds-seg button').forEach(b => b.classList.toggle('on', b.dataset.r === '10'));
  $$('#q-type-seg button').forEach(b => b.classList.toggle('on', b.dataset.t === 'mixed'));
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
$$('#q-type-seg button').forEach(b => b.addEventListener('click', () => { Q.enter.qtype = b.dataset.t; $$('#q-type-seg button').forEach(x => x.classList.toggle('on', x === b)); Sound.button(); }));

$('#q-create').addEventListener('click', () => {
  Sound.button();
  const settings = { mode: Q.enter.mode, buyIn: Q.enter.buyIn, category: Q.enter.cat, difficulty: Q.enter.diff, totalRounds: Q.enter.rounds, qtype: Q.enter.qtype };
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
function enterQuiz() { N.showScreen('screen-quiz'); if (Q.room) render(); }

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
  $('#screen-quiz').style.setProperty('--qcat', (room.question && room.question.color) || '#28d695');

  // stop any audio between rounds (wager/lobby/gameover)
  if (room.phase === 'wager' || room.phase === 'lobby' || room.phase === 'gameover') audioDestroy();
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
  $('#q-start').classList.remove('hidden');                 // anyone can start
  $('#q-settings-open').classList.toggle('hidden', !isHost);
  $('#q-lobby-wait').textContent = 'Starte, wenn alle bereit sind';
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

/* ---- audio-only player via YouTube IFrame API (invisible player, our own button) ---- */
let _ytAudio = null;
function ensureYTApi(cb) {
  if (window.YT && window.YT.Player) return cb();
  if (!document.getElementById('yt-iframe-api')) { const s = document.createElement('script'); s.id = 'yt-iframe-api'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }
  let n = 0; const t = setInterval(() => { if (window.YT && window.YT.Player) { clearInterval(t); cb(); } else if (++n > 80) clearInterval(t); }, 150);
}
function audioDestroy() { if (_ytAudio) { try { _ytAudio.destroy(); } catch (e) {} _ytAudio = null; } }
function audioSetup(id) {
  audioDestroy();
  ensureYTApi(() => {
    if (!document.getElementById('q-yt-audio')) return;
    try { _ytAudio = new YT.Player('q-yt-audio', { width: '100%', height: '100%', videoId: id, playerVars: { playsinline: 1, controls: 0, rel: 0, fs: 0, modestbranding: 1 }, events: {} }); } catch (e) {}
  });
}
function audioToggle(btn) {
  if (!_ytAudio || !_ytAudio.getPlayerState) return;
  let st = -1; try { st = _ytAudio.getPlayerState(); } catch (e) {}
  if (st === 1) { try { _ytAudio.pauseVideo(); } catch (e) {} if (btn) btn.textContent = '▶ Weiter'; }
  else { try { _ytAudio.unMute(); _ytAudio.setVolume(100); _ytAudio.playVideo(); } catch (e) {} if (btn) btn.textContent = '⏸ Pause'; }
}

function renderPlay(room, reveal) {
  const me = myP();
  const type = room.question.type || 'mc';
  $('#q-text').textContent = room.question.q || '';
  const blocked = !me || me.locked || me.spectator || me.eliminated;

  const isMC = (type === 'mc' || type === 'tf' || type === 'emoji' || type === 'video' || type === 'intro' || type === 'audio');
  // toggle input areas
  $('#q-options').style.display = isMC ? 'grid' : 'none';
  $('#q-estimate').classList.toggle('hidden', type !== 'est');
  $('#q-list').classList.toggle('hidden', type !== 'list');
  // emoji media banner
  const em = $('#q-emoji-media');
  if (type === 'emoji') { em.classList.remove('hidden'); if (em._e !== room.question.emoji) { em._e = room.question.emoji; em.innerHTML = `<div class="emo">${esc(room.question.emoji || '')}</div>`; } }
  else { em.classList.add('hidden'); em._e = null; }
  // video / intro = visible iframe; audio = invisible API player + own button
  const vm = $('#q-video-media');
  if ((type === 'video' || type === 'intro') && room.question.yt) {
    audioDestroy();
    vm.classList.remove('hidden'); vm.classList.remove('audio-mode');
    const key = type + ':' + room.question.yt;
    if (vm._v !== key) {
      vm._v = key; const id = encodeURIComponent(room.question.yt);
      let params = 'rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0';
      if (type === 'intro') params += `&autoplay=1&mute=1&start=0&end=${room.question.ytEnd || 8}`;
      vm.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?${params}" title="Clip" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` +
        `<div class="q-video-cover"></div>` +
        (type === 'intro' ? `<div class="q-intro-badge">🔊 zum Hören antippen</div>` : '') +
        `<a class="q-video-fallback" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">▶ YouTube</a>`;
    }
  } else if (type === 'audio' && room.question.yt) {
    vm.classList.remove('hidden'); vm.classList.add('audio-mode');
    const key = 'audio:' + room.question.yt;
    if (vm._v !== key) {
      vm._v = key;
      vm.innerHTML = `<div id="q-yt-audio"></div>` +
        `<div class="q-audio-card"><div class="ac-icon">🎧</div><button class="q-audio-play" id="q-audio-play">▶ Ton abspielen</button><div class="ac-sub">nur Ton — errate es!</div></div>`;
      audioSetup(room.question.yt);
      const b = document.getElementById('q-audio-play'); if (b) b.onclick = () => audioToggle(b);
    }
    if (reveal) { // round over: stop sound and reveal the clip
      try { if (_ytAudio && _ytAudio.pauseVideo) _ytAudio.pauseVideo(); } catch (e) {}
      const card = vm.querySelector('.q-audio-card'); if (card) card.style.display = 'none';
      const pl = document.getElementById('q-yt-audio'); if (pl) pl.style.opacity = '1';
    }
  } else { vm.classList.add('hidden'); vm.classList.remove('audio-mode'); vm._v = null; vm.innerHTML = ''; audioDestroy(); }
  // 50:50 for mc, emoji, video, intro & audio
  $('#q-pu-fifty').style.display = ((type === 'mc' || type === 'emoji' || type === 'video' || type === 'intro' || type === 'audio') && room.settings.powerups) ? '' : 'none';
  $('#q-pu-double').style.display = room.settings.powerups ? '' : 'none';
  $('#q-powerups').style.display = room.settings.powerups ? 'flex' : 'none';

  if (isMC) renderOptions(room, reveal, me, type);
  else if (type === 'est') renderEstimate(room, reveal, me);
  else if (type === 'list') renderList(room, reveal, me);

  if (me) {
    $('#q-pu-fifty-n').textContent = me.powerups ? me.powerups.fifty : 0;
    $('#q-pu-double-n').textContent = me.doubleActive ? '✓' : (me.powerups ? me.powerups.double : 0);
    $('#q-pu-fifty').disabled = reveal || blocked || type !== 'mc' || !me.powerups || me.powerups.fifty <= 0;
    $('#q-pu-double').disabled = reveal || !me.powerups || me.powerups.double <= 0 || me.doubleActive || me.locked || me.spectator || me.eliminated;
    $('#q-pu-double').classList.toggle('armed', me.doubleActive);
    $('#q-play-wager').textContent = fmt(me.wager || 0);
  }

  // result banner
  const res = $('#q-result');
  if (reveal && me && !me.spectator && !me.eliminated) {
    if (me.correct) { res.className = 'q-result show win'; res.innerHTML = `+${fmt(me.roundDelta)} <small>Richtig!${me.streak >= 2 ? ' 🔥 Serie ' + me.streak : ''}</small>`; }
    else { res.className = 'q-result show lose'; res.innerHTML = `${fmt(me.roundDelta)} <small>${revealMissText(type, me)}</small>`; }
  } else { res.className = 'q-result'; res.innerHTML = ''; }
}
function revealMissText(type, me) {
  if (type === 'list') return me.foundCount ? me.foundCount + ' gefunden' : 'Nichts gefunden';
  if (type === 'est') return me.estimate == null ? 'Keine Schätzung' : 'Zu weit daneben';
  return (me.answer == null || me.answer < 0) ? 'Keine Antwort' : 'Leider falsch';
}

function renderOptions(room, reveal, me, type) {
  const grid = $('#q-options');
  grid.classList.toggle('two', type === 'tf');
  if (grid._q !== room.question.q) {
    grid._q = room.question.q; grid.innerHTML = '';
    (room.question.options || []).forEach((opt, i) => {
      const b = document.createElement('button'); b.className = 'q-opt'; b.dataset.i = i;
      b.innerHTML = `<span class="ol">${type === 'tf' ? (i === 0 ? '✓' : '✗') : 'ABCD'[i]}</span><span class="ot">${esc(opt)}</span><span class="mark ok">${ic('check')}</span><span class="mark no">${ic('close')}</span>`;
      b.onclick = () => answer(i);
      grid.appendChild(b);
    });
    Q.fiftyRemoved.forEach(i => { const el = grid.querySelector(`.q-opt[data-i="${i}"]`); if (el) el.classList.add('removed'); });
  }
  const myAnswer = reveal ? (me && me.answer) : (me && me.locked ? me.answer : -1);
  $$('.q-opt', grid).forEach(b => {
    const i = +b.dataset.i;
    b.classList.toggle('picked', myAnswer === i && (reveal ? true : me && me.locked));
    if (reveal) { b.classList.add('locked'); b.classList.toggle('correct', i === room.question.answer); b.classList.toggle('wrong', i !== room.question.answer); }
    else { b.classList.remove('correct', 'wrong'); b.classList.toggle('locked', !!(me && me.locked) || (me && (me.spectator || me.eliminated))); }
  });
}
function answer(i) {
  const me = myP(); if (!me || me.locked || Q.room.phase !== 'question' || me.spectator || me.eliminated) return;
  if (Q.fiftyRemoved.includes(i)) return;
  socket.emit('quiz:answer', { index: i }); Sound.button(); vibrate(12);
}

function renderEstimate(room, reveal, me) {
  $('#q-est-unit').textContent = room.question.unit || '';
  const inp = $('#q-est-input'), btn = $('#q-est-submit'), hint = $('#q-est-hint'), gauge = $('#q-est-gauge');
  if (reveal) {
    inp.disabled = true; btn.disabled = true;
    const correct = Number(room.question.answer) || 0;
    const mine = (me && me.estimate != null) ? Number(me.estimate) : null;
    const unit = room.question.unit || '';
    gauge.classList.remove('hidden');
    if (gauge._r !== room.round) {
      gauge._r = room.round;
      const maxV = (Math.max(correct, mine || 0) * 1.15) || 1;
      const cPct = Math.max(3, Math.min(97, correct / maxV * 100));
      const mPct = mine != null ? Math.max(3, Math.min(97, mine / maxV * 100)) : null;
      gauge.innerHTML = `<div class="gline"></div>` +
        (mPct != null ? `<div class="gmark you" style="left:0%"><span class="gdot"></span><span class="glab">Du</span></div>` : '') +
        `<div class="gmark correct" style="left:0%"><span class="gdot"></span><span class="glab">Lösung</span></div>`;
      requestAnimationFrame(() => {
        const cm = gauge.querySelector('.gmark.correct'); if (cm) cm.style.left = cPct + '%';
        const ym = gauge.querySelector('.gmark.you'); if (ym && mPct != null) ym.style.left = mPct + '%';
      });
      countUpEst(hint, correct, unit, mine);
    }
  } else {
    gauge.classList.add('hidden'); gauge._r = null;
    const locked = me && me.locked;
    inp.disabled = !!locked || (me && (me.spectator || me.eliminated));
    btn.disabled = inp.disabled;
    btn.textContent = locked ? 'Getippt ✓' : 'Tippen';
    hint.textContent = locked ? 'Dein Tipp ist abgegeben.' : 'Am nächsten dran gewinnt am meisten.';
  }
}
function countUpEst(el, to, unit, mine) {
  const dur = 1100, start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const v = Math.round(to * (1 - Math.pow(1 - p, 3)));
    el.innerHTML = `Lösung: <b>${fmt(v)} ${esc(unit)}</b>` + (mine != null ? ` · Dein Tipp: <b>${fmt(mine)}</b>` : '');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function submitEstimate() {
  const me = myP(); if (!me || me.locked || Q.room.phase !== 'question' || Q.room.question.type !== 'est') return;
  const v = parseFloat($('#q-est-input').value.replace(',', '.')); if (!isFinite(v)) { toast('Zahl eingeben', 'bad'); return; }
  socket.emit('quiz:estimate', { value: v }); Sound.chip(); vibrate(10);
}
$('#q-est-submit').addEventListener('click', submitEstimate);
$('#q-est-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitEstimate(); });

function listNorm(s) { return (s || '').toString().toLowerCase().trim().replace(/ß/g, 'ss').replace(/[-_/.]/g, ' ').replace(/\s+/g, ' ').trim(); }
function renderList(room, reveal, me) {
  const target = room.question.target || 10;
  if (Q.listRound !== room.round) { Q.listRound = room.round; Q.myFound = []; $('#q-list-input').value = ''; }
  const inp = $('#q-list-input'), add = $('#q-list-add');
  const blocked = reveal || (me && (me.locked || me.spectator || me.eliminated));
  inp.disabled = !!blocked; add.disabled = !!blocked;
  const foundCount = me ? me.foundCount : Q.myFound.length;
  $('#q-list-progress').innerHTML = `Gefunden <b>${foundCount}</b> / ${target}` + (reveal ? '' : ' — fülle die Liste!');
  const wrap = $('#q-list-found'); wrap.classList.add('numbered');

  if (reveal && room.question.items) {
    // numbered Top-list 1..N, mark which I found, reveal the missing ones
    const canon = room.question.items.slice(0, target);
    const mineN = Q.myFound.map(listNorm);
    wrap.innerHTML = canon.map((it, i) => {
      const c = listNorm(it);
      const hit = mineN.some(m => c === m || (m.length >= 3 && c.includes(m)) || (c.length >= 3 && m.includes(c)));
      return `<div class="lrow ${hit ? 'hit' : 'miss'}"><span class="ln">${i + 1}</span><span class="lt">${esc(it)}</span>${hit ? `<span class="lc">${ic('check')}</span>` : ''}</div>`;
    }).join('');
  } else {
    // during play: numbered slots fill up as you find answers; empty slots show what's left
    const slots = new Array(target).fill(null);
    Q.myFound.forEach((f, i) => { if (i < target) slots[i] = f; });
    wrap.innerHTML = slots.map((s, i) => s
      ? `<div class="lrow hit"><span class="ln">${i + 1}</span><span class="lt">${esc(s)}</span><span class="lc">${ic('check')}</span></div>`
      : `<div class="lrow empty"><span class="ln">${i + 1}</span><span class="lt">— — —</span></div>`
    ).join('');
  }
}
function submitListGuess() {
  const me = myP(); if (!me || Q.room.phase !== 'question' || Q.room.question.type !== 'list' || me.spectator || me.eliminated) return;
  const t = $('#q-list-input').value.trim(); if (!t) return;
  socket.emit('quiz:listguess', { text: t }); $('#q-list-input').value = ''; $('#q-list-input').focus();
}
$('#q-list-add').addEventListener('click', submitListGuess);
$('#q-list-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitListGuess(); });

$('#q-pu-fifty').addEventListener('click', () => { socket.emit('quiz:powerup', { type: 'fifty' }); Sound.button(); });
$('#q-pu-double').addEventListener('click', () => { socket.emit('quiz:powerup', { type: 'double' }); Sound.chip(); });

function renderGameover(room) {
  const w = room.winner || {};
  const me = myP();
  $('#q-win-name').textContent = w.name || 'Niemand';
  $('#q-win-pot').innerHTML = room.mode === 'tournament' && w.pool ? `<span class="mini-icon">${ic('coins')}</span> ${fmt(w.pool)} gewonnen` : 'Gut gespielt!';
  const rk = $('#q-ranking'); rk.innerHTML = '';
  (w.ranking || []).forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'q-rank-row rank-' + (i + 1);
    const medal = ['🥇', '🥈', '🥉'][i] || (i + 1);
    row.innerHTML = `<div class="r">${medal}</div><div class="n">${esc(p.name)}<small>${p.correct} richtig · beste Serie ${p.best}</small></div><div class="c"><span class="mini-icon">${ic('coins')}</span>${fmt(p.chips)}</div>`;
    rk.appendChild(row);
  });
  $('#q-rematch').classList.remove('hidden');   // anyone can start the next round
  $('#q-rematch').disabled = false;
  $('#q-rematch-wait').classList.add('hidden');
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

/* ============================ TIMER (independent loop) ============================ */
function ensureTimerLoop() {
  if (Q._timerLoop) return;
  const loop = () => { Q._timerLoop = requestAnimationFrame(loop); try { updateTimerUI(); } catch (e) {} };
  Q._timerLoop = requestAnimationFrame(loop);
}
function updateTimerUI() {
  const room = Q.room; const fill = $('#q-timerfill'), num = $('#q-timer-num');
  if (!fill || !num) return;
  if (!room || !$('#screen-quiz').classList.contains('active')) { num.textContent = ''; return; }
  const total = room.phase === 'wager' ? room.settings.wagerTime : room.phase === 'question' ? room.settings.questionTime : room.phase === 'reveal' ? 5 : 0;
  if (!total || !room.timerEndsAt) { num.textContent = ''; fill.style.width = '100%'; fill.className = 'q-timerfill'; return; }
  const remain = Math.max(0, room.timerEndsAt - (Date.now() + (Q._drift || 0)));
  const frac = Math.min(1, remain / (total * 1000));
  fill.style.width = (frac * 100) + '%';
  fill.className = 'q-timerfill' + (frac < .25 ? ' danger' : frac < .5 ? ' warn' : '');
  num.textContent = room.phase === 'reveal' ? '' : Math.ceil(remain / 1000);
}
function renderTimer() { updateTimerUI(); }

/* ============================ FX ============================ */
function onFx(e) {
  switch (e.type) {
    case 'matchStart': toast('Quiz startet!', 'gold', true, 'bolt'); FX.rain(); break;
    case 'wagerOpen': Q.fiftyRemoved = []; Q.myFound = []; Sound.turn(); break;
    case 'listmatch': if (!Q.myFound.includes(e.item)) Q.myFound.push(e.item); Sound.win(); vibrate(12); toast('✓ ' + e.item + ' (' + e.count + '/' + e.target + ')', 'good'); render(); break;
    case 'listmiss': Sound.lose(); vibrate(40); break;
    case 'listdup': toast('Schon genannt', '', false); break;
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
function flashScreen(kind) {
  const f = $('#q-flash'); if (!f) return;
  f.className = 'q-flash ' + kind; void f.offsetWidth; f.classList.add('show');
  setTimeout(() => f.classList.remove('show'), 700);
}
function revealFx() {
  const me = myP();
  if (me && !me.spectator && !me.eliminated) {
    if (me.correct) { Sound.win(); vibrate([20, 40, 20]); flashScreen('good'); FX.burst(innerWidth / 2, innerHeight * 0.4, 60); }
    else { Sound.lose(); vibrate(100); flashScreen('bad'); }
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
$('#q-rematch').addEventListener('click', () => { socket.emit('quiz:start'); Sound.button(); $('#q-rematch').disabled = true; });
$('#q-tohub').addEventListener('click', () => { audioDestroy(); socket.emit('quiz:leave'); Q.room = null; Q.me = null; N.showScreen('screen-hub'); setTimeout(() => { N.refreshMe(); N.loadHub(); }, 400); Sound.button(); });
$('#q-leave').addEventListener('click', () => { if (confirm('Quiz verlassen?')) { audioDestroy(); socket.emit('quiz:leave'); Q.room = null; Q.me = null; N.showScreen('screen-hub'); setTimeout(() => { N.refreshMe(); N.loadHub(); }, 400); } });
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

$$('[data-close]').forEach(b => b.addEventListener('click', () => { const el = $('#' + b.dataset.close); if (el) el.classList.remove('open'); }));

window.NOVAQuiz = { bindSocket, openEnter };
})();
