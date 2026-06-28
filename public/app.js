/* =======================================================================
   NOVA CASINO — client. Auth · Hub · Blackjack (cash & tournament).
   ======================================================================= */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SUIT = { S: 'spade', H: 'heart', D: 'diamond', C: 'club' };
const ic = (n) => ICON.get(n);

const store = {
  token: localStorage.getItem('nova_token') || null,
  account: null,
};
const state = {
  socket: null, me: null, room: null,
  pendingBet: { amount: 0, perfectPairs: 0, twentyOnePlus3: 0 },
  activeSideBet: null, lastSeenCards: {}, timerRAF: null,
  enterMode: 'cash', enterBuyIn: 1000,
};

/* ============================ SOUND ============================ */
const Sound = (() => {
  let ctx = null, master = null, muted = false;
  function ensure() { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination); } if (ctx.state === 'suspended') ctx.resume(); }
  function tone(f, d, t = 'sine', v = .3, slide = null, delay = 0) { if (muted) return; ensure(); const tm = ctx.currentTime + delay; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = t; o.frequency.setValueAtTime(f, tm); if (slide) o.frequency.exponentialRampToValueAtTime(slide, tm + d); g.gain.setValueAtTime(.0001, tm); g.gain.exponentialRampToValueAtTime(v, tm + .01); g.gain.exponentialRampToValueAtTime(.0001, tm + d); o.connect(g); g.connect(master); o.start(tm); o.stop(tm + d + .02); }
  function noise(d, v = .2) { if (muted) return; ensure(); const buf = ctx.createBuffer(1, ctx.sampleRate * d, ctx.sampleRate); const dd = buf.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / dd.length); const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.value = v; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; src.connect(f); f.connect(g); g.connect(master); src.start(); }
  return {
    deal() { noise(.12, .18); tone(420, .07, 'triangle', .12); }, chip() { tone(900, .05, 'square', .1); tone(1300, .04, 'square', .06, null, .02); },
    flip() { noise(.1, .16); }, hit() { tone(520, .08, 'triangle', .14); },
    win() {[523, 659, 784, 1046].forEach((f, i) => tone(f, .18, 'triangle', .22, null, i * .08)); },
    blackjack() {[659, 784, 988, 1318, 1568].forEach((f, i) => tone(f, .22, 'sawtooth', .18, null, i * .07)); },
    fanfare() {[523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .3, 'triangle', .2, null, i * .12)); },
    lose() { tone(300, .3, 'sine', .2, 120); }, bust() { tone(200, .4, 'sawtooth', .22, 70); noise(.2, .12); },
    push() { tone(440, .15, 'sine', .16); }, button() { tone(660, .04, 'square', .07); },
    turn() { tone(880, .1, 'sine', .14, 1100); }, elim() { tone(330, .5, 'sawtooth', .2, 90); },
  };
})();
function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

/* ============================ CONFETTI ============================ */
const FX = (() => {
  const cv = $('#fxCanvas'); const cx = cv.getContext('2d'); let parts = [], raf = null;
  function resize() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
  addEventListener('resize', resize); resize();
  function loop() { cx.clearRect(0, 0, cv.width, cv.height); parts = parts.filter(p => p.life > 0); for (const p of parts) { p.vy += .25; p.x += p.vx; p.y += p.vy; p.life--; p.rot += p.vr; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.globalAlpha = Math.max(0, p.life / p.max); cx.fillStyle = p.color; cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); cx.restore(); } if (parts.length) raf = requestAnimationFrame(loop); else raf = null; }
  function burst(x, y, n = 60, cols = ['#ffd76a', '#28d695', '#ff5d6c', '#7bd1ff', '#fff']) { x *= devicePixelRatio; y *= devicePixelRatio; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = (Math.random() * 8 + 4) * devicePixelRatio, max = 60 + Math.random() * 50; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6 * devicePixelRatio, s: (Math.random() * 8 + 5) * devicePixelRatio, color: cols[i % cols.length], life: max, max, rot: Math.random() * 6, vr: (Math.random() - .5) * .4 }); } if (!raf) loop(); }
  function rain() { for (let i = 0; i < 140; i++) parts.push({ x: Math.random() * cv.width, y: -20 * devicePixelRatio, vx: (Math.random() - .5) * 3, vy: Math.random() * 4 + 2, s: (Math.random() * 9 + 5) * devicePixelRatio, color: ['#ffd76a', '#28d695', '#ff5d6c', '#7bd1ff', '#fff'][i % 5], life: 170, max: 170, rot: Math.random() * 6, vr: (Math.random() - .5) * .4 }); if (!raf) loop(); }
  return { burst, rain };
})();

/* ============================ TOAST ============================ */
function toast(msg, kind = '', big = false, iconName = null) {
  const t = document.createElement('div'); t.className = 'toast ' + kind + (big ? ' big' : '');
  t.innerHTML = (iconName ? `<span class="ti">${ic(iconName)}</span>` : '') + `<span>${msg}</span>`;
  $('#toast-wrap').appendChild(t); setTimeout(() => t.remove(), 3000);
}

/* ============================ SCREEN NAV ============================ */
function showScreen(id) { $$('.screen').forEach(s => s.classList.remove('active')); $('#' + id).classList.add('active'); }

/* ============================ AUTH ============================ */
let authTab = 'login';
$('#tab-login').addEventListener('click', () => setAuthTab('login'));
$('#tab-register').addEventListener('click', () => setAuthTab('register'));
function setAuthTab(t) { authTab = t; $('#tab-login').classList.toggle('active', t === 'login'); $('#tab-register').classList.toggle('active', t === 'register'); $('#auth-btn-label').textContent = t === 'login' ? 'Anmelden' : 'Konto erstellen'; $('#auth-error').textContent = ''; Sound.button(); }
$('#auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); });
$('#btn-auth').addEventListener('click', doAuth);
async function doAuth() {
  Sound.button();
  const username = $('#auth-user').value.trim(); const password = $('#auth-pass').value;
  if (!username || !password) { $('#auth-error').textContent = 'Bitte Name & Passwort eingeben'; vibrate(40); return; }
  try {
    const res = await fetch('/api/' + (authTab === 'login' ? 'login' : 'register'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { $('#auth-error').textContent = data.message || 'Fehler'; vibrate(60); return; }
    store.token = data.token; store.account = data.account;
    localStorage.setItem('nova_token', data.token);
    onAuthed();
  } catch (e) { $('#auth-error').textContent = 'Serverfehler'; }
}
$('#btn-logout').addEventListener('click', async () => {
  Sound.button();
  try { await fetch('/api/logout', { method: 'POST', headers: authHeader() }); } catch {}
  localStorage.removeItem('nova_token'); store.token = null; store.account = null;
  if (state.socket) state.socket.disconnect();
  showScreen('screen-auth');
});
function authHeader() { return { 'Authorization': 'Bearer ' + store.token, 'Content-Type': 'application/json' }; }

async function tryResume() {
  if (!store.token) { showScreen('screen-auth'); return; }
  try {
    const res = await fetch('/api/me', { headers: authHeader() });
    if (!res.ok) throw 0;
    const data = await res.json(); store.account = data.account; onAuthed();
  } catch { localStorage.removeItem('nova_token'); store.token = null; showScreen('screen-auth'); }
}
function onAuthed() {
  connectSocket();
  renderProfile();
  loadHub();
  showScreen('screen-hub');
  Sound.button();
}

/* ============================ PROFILE / HUB ============================ */
function renderProfile() {
  const a = store.account; if (!a) return;
  $('#pc-avatar').textContent = a.username[0].toUpperCase();
  $('#pc-name').textContent = a.username;
  $('#pc-money').textContent = fmt(a.money);
  $('#hero-name').textContent = a.username;
  $('#btn-bonus').classList.toggle('hidden', a.money >= 1000);
  $('#btn-admin').classList.toggle('hidden', !a.isAdmin);
}
$('#btn-bonus').addEventListener('click', async () => {
  Sound.chip();
  try { const r = await fetch('/api/bonus', { method: 'POST', headers: authHeader() }); const d = await r.json(); store.account = d.account; renderProfile(); toast('Gratis-Chips erhalten!', 'gold', false, 'gift'); FX.burst(innerWidth / 2, innerHeight / 2, 40); } catch {}
});

async function loadHub() {
  try {
    const [g, b] = await Promise.all([fetch('/api/games').then(r => r.json()), fetch('/api/leaderboard').then(r => r.json())]);
    renderGames(g.games); renderHubBoard(b.leaderboard);
  } catch {}
}
const GAME_ICON = { blackjack: 'cards', poker: 'spade', roulette: 'chip', slots: 'bolt' };
function renderGames(games) {
  const grid = $('#games-grid'); grid.innerHTML = '';
  for (const game of games) {
    const card = document.createElement('div');
    card.className = 'game-card ' + game.status;
    card.innerHTML =
      (game.status === 'soon' ? `<span class="gc-soon">BALD</span>` : '') +
      `<span class="gc-icon">${ic(GAME_ICON[game.id] || 'cards')}</span>` +
      `<div><div class="gc-name">${esc(game.name)}</div><div class="gc-tag">${esc(game.tagline)}</div></div>` +
      (game.status === 'live'
        ? `<div class="gc-foot"><span class="gc-dot"></span>${game.online} online</div>`
        : `<div class="gc-foot" style="color:var(--muted)">Coming soon</div>`);
    if (game.status === 'live' && game.id === 'blackjack') card.addEventListener('click', () => openEnter());
    grid.appendChild(card);
  }
}
function renderHubBoard(list) {
  const wrap = $('#hub-board'); wrap.innerHTML = '';
  if (!list.length) { wrap.innerHTML = `<div style="padding:18px;text-align:center;color:var(--muted)">Noch keine Spieler.</div>`; return; }
  list.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'board-row rank-' + (i + 1) + (store.account && p.username === store.account.username ? ' me' : '');
    const medal = i < 3 ? `<span class="medal">${ic('medal')}</span>` : (i + 1);
    row.innerHTML =
      `<div class="board-rank">${medal}</div>` +
      `<div class="board-name">${esc(p.username)}<small>${p.matchesWon} Turniere · ${p.blackjacks} Blackjacks</small></div>` +
      `<div class="board-chips"><span class="mini-icon">${ic('coins')}</span>${fmt(p.money)}</div>`;
    wrap.appendChild(row);
  });
}

/* ============================ ADMIN PANEL ============================ */
let adminPlayers = [];
$('#btn-admin').addEventListener('click', () => { Sound.button(); $('#modal-admin').classList.add('open'); loadAdmin(); });
$('#admin-refresh').addEventListener('click', () => { loadAdmin(); Sound.button(); });
$('#admin-search').addEventListener('input', renderAdminList);
async function loadAdmin() {
  try {
    const r = await fetch('/api/admin/players', { headers: authHeader() });
    if (!r.ok) { toast('Keine Adminrechte', 'bad'); return; }
    adminPlayers = (await r.json()).players; renderAdminList();
  } catch { toast('Fehler beim Laden', 'bad'); }
}
function renderAdminList() {
  const q = $('#admin-search').value.trim().toLowerCase();
  const list = adminPlayers.filter(p => !q || p.username.toLowerCase().includes(q));
  $('#admin-count').textContent = `${adminPlayers.length} Spieler · ${adminPlayers.filter(p => p.online).length} online`;
  const body = $('#admin-body'); body.innerHTML = '';
  for (const p of list) {
    const row = document.createElement('div'); row.className = 'admin-row' + (p.isAdmin ? ' is-admin' : '');
    const date = new Date(p.created).toLocaleDateString('de-DE');
    row.innerHTML =
      `<div class="ar-top">` +
        `<div class="ar-avatar ${p.isAdmin ? 'admin' : ''}">${esc(p.username[0].toUpperCase())}</div>` +
        `<div class="ar-id"><div class="ar-name">${esc(p.username)}${p.isAdmin ? '<span class="badge adm">ADMIN</span>' : ''}${p.online ? '<span class="badge on">ONLINE</span>' : ''}</div>` +
        `<div class="ar-sub">${p.stats.matchesWon} Turniere · ${p.stats.blackjacks} BJ · seit ${date}</div></div>` +
        `<div class="ar-money"><span class="mini-icon">${ic('coins')}</span>${fmt(p.money)}</div>` +
      `</div>` +
      `<div class="ar-actions">` +
        `<div class="ar-money-edit"><input type="number" value="${p.money}" min="0" data-money="${esc(p.username)}" /><button class="ar-btn gold" data-act="money" data-user="${esc(p.username)}"><span>${ic('save')}</span>Setzen</button></div>` +
        `<button class="ar-btn blue" data-act="pw" data-user="${esc(p.username)}"><span>${ic('key')}</span>Passwort</button>` +
        `<button class="ar-btn" data-act="admin" data-user="${esc(p.username)}" data-is="${p.isAdmin ? 1 : 0}"><span>${ic('admin')}</span>${p.isAdmin ? 'Admin entz.' : 'Zu Admin'}</button>` +
        `<button class="ar-btn danger" data-act="del" data-user="${esc(p.username)}"><span>${ic('trash')}</span>Löschen</button>` +
      `</div>`;
    body.appendChild(row);
  }
  $$('.ar-btn', body).forEach(b => b.addEventListener('click', onAdminAction));
}
async function onAdminAction(e) {
  const btn = e.currentTarget; const act = btn.dataset.act; const user = btn.dataset.user;
  if (act === 'money') {
    const inp = $(`input[data-money="${CSS.escape(user)}"]`); const val = parseInt(inp.value, 10);
    await adminPost('/api/admin/money', { username: user, money: val }, `${esc(user)}: Guthaben = ${fmt(val)}`);
  } else if (act === 'pw') {
    const np = prompt(`Neues Passwort für ${user} (mind. 4 Zeichen):`); if (!np) return;
    await adminPost('/api/admin/password', { username: user, password: np }, `Passwort von ${esc(user)} zurückgesetzt`);
  } else if (act === 'admin') {
    const makeAdmin = btn.dataset.is !== '1';
    await adminPost('/api/admin/setAdmin', { username: user, isAdmin: makeAdmin }, `${esc(user)}: Admin ${makeAdmin ? 'aktiviert' : 'entzogen'}`);
  } else if (act === 'del') {
    if (!confirm(`Konto "${user}" wirklich löschen?`)) return;
    await adminPost('/api/admin/delete', { username: user }, `${esc(user)} gelöscht`);
  }
  loadAdmin();
}
async function adminPost(url, body, okMsg) {
  try {
    const r = await fetch(url, { method: 'POST', headers: authHeader(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.message || 'Fehler', 'bad'); return false; }
    toast(okMsg, 'good', false, 'admin'); Sound.chip();
    refreshMe(); loadHub();
    return true;
  } catch { toast('Serverfehler', 'bad'); return false; }
}

/* ============================ ENTER MODAL ============================ */
const BUYINS = [500, 1000, 2500, 5000];
function buildBuyInSeg() {
  const seg = $('#buyin-seg'); seg.innerHTML = '';
  for (const v of BUYINS) { const b = document.createElement('button'); b.textContent = fmt(v); if (v === state.enterBuyIn) b.classList.add('on'); b.addEventListener('click', () => { state.enterBuyIn = v; $$('#buyin-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on'); Sound.button(); }); seg.appendChild(b); }
}
function openEnter() { state.enterMode = 'cash'; updateEnterMode(); buildBuyInSeg(); $('#enter-error').textContent = ''; $('#modal-enter').classList.add('open'); Sound.button(); }
$$('.mode-opt').forEach(b => b.addEventListener('click', () => { state.enterMode = b.dataset.mode; updateEnterMode(); Sound.button(); }));
function updateEnterMode() { $$('.mode-opt').forEach(b => b.classList.toggle('active', b.dataset.mode === state.enterMode)); $('#tourney-buyin').classList.toggle('hidden', state.enterMode !== 'tournament'); }
$('#btn-create').addEventListener('click', () => {
  Sound.button();
  const settings = state.enterMode === 'tournament' ? { mode: 'tournament', buyIn: state.enterBuyIn } : { mode: 'cash' };
  state.socket.emit('createRoom', { settings }, res => {
    if (res && res.ok) { state.me = res.playerId; enterGame(); $('#modal-enter').classList.remove('open'); }
    else $('#enter-error').textContent = res && res.message || 'Konnte Raum nicht erstellen';
  });
});
$('#btn-join').addEventListener('click', joinRoom);
$('#inp-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
function joinRoom() {
  Sound.button();
  const code = $('#inp-code').value.trim().toUpperCase();
  if (code.length !== 4) { $('#enter-error').textContent = 'Code = 4 Zeichen'; return; }
  state.socket.emit('joinRoom', { roomCode: code }, res => {
    if (res && res.ok) { state.me = res.playerId; enterGame(); $('#modal-enter').classList.remove('open'); if (res.spectator) toast(res.message || 'Zuschauer-Modus', '', false, 'eye'); }
    else { const m = { no_room: 'Raum nicht gefunden', full: 'Raum ist voll', already_in: 'Schon im Raum', broke: 'Zu wenig Geld' }; $('#enter-error').textContent = res && (m[res.error] || res.message) || 'Beitritt fehlgeschlagen'; }
  });
}
function enterGame() { showScreen('screen-game'); if (state.room) render(); }

if (location.hash.length === 5) { /* deep link handled after auth in connect */ }

/* ============================ SOCKET ============================ */
function connectSocket() {
  if (state.socket) { state.socket.disconnect(); }
  const socket = io({ transports: ['websocket', 'polling'], auth: { token: store.token } });
  state.socket = socket;
  socket.on('connect_error', (e) => { if (e && e.message === 'unauthorized') { localStorage.removeItem('nova_token'); showScreen('screen-auth'); } });
  socket.on('account', (acc) => { if (acc) { store.account = acc; renderProfile(); } });
  socket.on('state', (room) => { state.room = room; render(); });
  socket.on('fx', onFx);
  socket.on('chat', onChat);
  socket.on('disconnect', () => toast('Verbindung verloren…', 'bad'));
}

/* ============================ HELPERS ============================ */
function myPlayer() { return state.room ? state.room.players.find(p => p.id === state.me) || null : null; }
function fmt(n) { return (n || 0).toLocaleString('de-DE'); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ============================ CARD RENDER ============================ */
function cardEl(card, opts = {}) {
  const el = document.createElement('div');
  if (card.hidden) { el.className = 'card back'; el.innerHTML = `<div class="pip">${ic('spade')}</div>`; return el; }
  const red = card.suit === 'H' || card.suit === 'D';
  el.className = 'card ' + (red ? 'red' : 'black') + (opts.win ? ' win-card' : '');
  const s = ic(SUIT[card.suit]);
  el.innerHTML = `<div class="corner tl"><span class="r">${card.rank}</span><span class="s">${s}</span></div><div class="pip">${s}</div><div class="corner br"><span class="r">${card.rank}</span><span class="s">${s}</span></div>`;
  return el;
}

/* ============================ RENDER ============================ */
function render() {
  const room = state.room; if (!room) return;
  $('#room-code').textContent = room.code;
  $('#shoe-left').textContent = room.shoeLeft;
  const badge = $('#mode-badge'); badge.className = 'mode-badge ' + room.mode; badge.textContent = room.mode === 'tournament' ? 'TURNIER' : 'FREI';
  const tb = $('#tourney-bar');
  if (room.mode === 'tournament') { tb.classList.remove('hidden'); $('#tb-pool').textContent = fmt(room.prizePool); $('#tb-alive').textContent = room.players.filter(p => !p.eliminated && !p.spectator).length; }
  else tb.classList.add('hidden');
  renderPhaseBanner(room); renderDealer(room); renderPlayers(room); renderDock(room); renderTimer(room); syncBetUI();
}
function renderPhaseBanner(room) {
  const map = {
    lobby: '🏁 Turnier-Lobby — warte auf Start',
    betting: 'Einsätze platzieren', dealing: 'Karten werden ausgeteilt',
    insurance: 'Versicherung?', dealerTurn: 'Dealer spielt', payout: 'Runde abgerechnet',
    matchOver: 'Turnier beendet',
  };
  let txt = map[room.phase] || '';
  if (room.phase === 'playerTurns') txt = room.activePlayerId === state.me ? 'Du bist am Zug!' : (activeName(room) + ' ist am Zug');
  $('#phase-banner').textContent = txt;
}
function activeName(room) { const p = room.players.find(x => x.id === room.activePlayerId); return p ? p.name : 'Spieler'; }

function renderDealer(room) {
  syncHand($('#dealer-hand'), room.dealer.cards, 'dealer');
  const v = room.dealer.value; $('#dealer-value').textContent = v ? v.total : '';
}

function renderPlayers(room) {
  const row = $('#players-row');
  row.classList.toggle('few', room.players.length <= 3);
  const ids = room.players.map(p => p.id);
  $$('.seat', row).forEach(s => { if (!ids.includes(s.dataset.pid)) s.remove(); });
  for (const p of room.players) {
    let seat = $(`.seat[data-pid="${p.id}"]`, row);
    if (!seat) { seat = document.createElement('div'); seat.dataset.pid = p.id; seat.innerHTML = `<div class="seat-hands"></div><div class="seat-info"></div>`; row.appendChild(seat); }
    seat.className = 'seat' + (p.id === state.me ? ' me' : '') + (p.id === room.activePlayerId ? ' active' : '') + (p.eliminated ? ' eliminated' : '') + (p.spectator ? ' spectator' : '');
    const handsWrap = $('.seat-hands', seat);
    const hands = p.hands.length ? p.hands : [{ cards: [], value: { total: 0 }, _empty: true }];
    while (handsWrap.children.length > hands.length) handsWrap.lastChild.remove();
    hands.forEach((h, hi) => {
      let hc = handsWrap.children[hi];
      if (!hc) { hc = document.createElement('div'); hc.className = 'seat-hand'; hc.innerHTML = `<span class="hand-val"></span><div class="hand"></div>`; handsWrap.appendChild(hc); }
      hc.classList.toggle('active', p.id === room.activePlayerId && room.activeHandIndex === hi && room.phase === 'playerTurns');
      const win = h.result === 'win' || h.result === 'blackjack';
      syncHand($('.hand', hc), h.cards || [], p.id + '-' + hi, win);
      const valEl = $('.hand-val', hc); const val = h.value ? h.value.total : 0;
      valEl.textContent = h._empty ? '' : val; valEl.classList.toggle('bust', val > 21); valEl.classList.toggle('bj', !!h.blackjack);
      if (h.result && hc._tag !== h.result) { hc._tag = h.result; showResultTag(hc, h.result); }
      if (!h.result) hc._tag = null;
    });
    const info = $('.seat-info', seat);
    const sbTotal = p.sideBets ? p.sideBets.perfectPairs + p.sideBets.twentyOnePlus3 : 0;
    const betStr = (p.hasBet || p.bet > 0) ? `${fmt(p.bet)}${sbTotal > 0 ? ` <span class="sb-chip">+${sbTotal}</span>` : ''}` : '';
    const streak = p.stats.streak;
    let tag = '';
    if (p.eliminated) tag = `<div class="elim-tag">RAUS</div>`;
    else if (p.spectator) tag = `<div class="spec-tag">ZUSCHAUER</div>`;
    else if (Math.abs(streak) >= 2) tag = `<div class="streak-badge ${streak > 0 ? 'hot' : 'cold'}"><span class="sbi">${ic(streak > 0 ? 'flame' : 'bolt')}</span>${streak > 0 ? streak : Math.abs(streak)}</div>`;
    info.innerHTML =
      `<div class="seat-name">${p.id === state.me ? `<span class="star">${ic('star')}</span>` : ''}${esc(p.name)}${p.isHost ? `<span class="crown">${ic('crown')}</span>` : ''}</div>` +
      `<div class="seat-chips"><span class="mini-icon">${ic('coins')}</span>${fmt(p.chips)}</div>` +
      (betStr ? `<div class="seat-bet">${betStr}</div>` : '') + tag;
  }
}
function showResultTag(hc, result) {
  const labels = { win: 'GEWINN', lose: 'VERLOREN', bust: 'BUST', push: 'PUSH', blackjack: 'BLACKJACK!', surrender: 'AUFGEGEBEN' };
  const tag = document.createElement('div'); tag.className = 'result-tag ' + result; tag.textContent = labels[result] || result;
  hc.appendChild(tag); setTimeout(() => tag.remove(), 3200);
}
function syncHand(handEl, cards, key, win) {
  const prev = state.lastSeenCards[key] || 0;
  if (cards.length < prev || handEl.children.length > cards.length) { handEl.innerHTML = ''; state.lastSeenCards[key] = 0; }
  for (let i = handEl.children.length; i < cards.length; i++) handEl.appendChild(cardEl(cards[i], { win }));
  for (let i = 0; i < cards.length; i++) {
    const ex = handEl.children[i]; const wantBack = !!cards[i].hidden; const isBack = ex && ex.classList.contains('back');
    if (ex && wantBack !== isBack) { const fresh = cardEl(cards[i], { win }); if (!wantBack && isBack) Sound.flip(); handEl.replaceChild(fresh, ex); }
    else if (ex && win && !ex.classList.contains('win-card') && !wantBack) ex.classList.add('win-card');
  }
  state.lastSeenCards[key] = cards.length;
}

/* ============================ DOCK ============================ */
function renderDock(room) {
  const me = myPlayer(); hideAllPanels();
  $('#btn-forfeit').classList.add('hidden');
  if (!me) { showPanel('wait-panel'); $('#wait-text').textContent = 'Verbinde…'; return; }

  if (room.phase === 'lobby') { renderLobby(room, me); return; }
  if (me.spectator) { showPanel('wait-panel'); $('#wait-text').textContent = '👁 Du schaust zu (nächstes Turnier dabei)'; return; }
  if (me.eliminated) { showPanel('wait-panel'); $('#wait-text').textContent = '💀 Ausgeschieden — viel Glück den anderen!'; return; }

  if (room.phase === 'betting') showPanel('bet-panel');
  else if (room.phase === 'insurance') { if (me.hands.length && me.bet > 0 && !me.insuranceAnswered) showPanel('insurance-panel'); else { showPanel('wait-panel'); $('#wait-text').textContent = 'Warte auf andere Spieler…'; } }
  else if (room.phase === 'playerTurns' && room.activePlayerId === state.me) { showPanel('action-panel'); updateActionButtons(room, me); maybeForfeit(room, me); }
  else if (['dealing', 'playerTurns', 'dealerTurn'].includes(room.phase)) { showPanel('wait-panel'); $('#wait-text').textContent = room.phase === 'dealerTurn' ? 'Dealer spielt…' : (room.activePlayerId ? `Warte auf ${activeName(room)}…` : 'Karten…'); maybeForfeit(room, me); }
  else if (room.phase === 'payout') { showPanel('wait-panel'); $('#wait-text').textContent = 'Runde abgerechnet…'; }
  else { showPanel('wait-panel'); $('#wait-text').textContent = 'Warte…'; }
}
function maybeForfeit(room, me) { if (room.mode === 'tournament' && room.matchActive && !me.eliminated && !me.spectator) $('#btn-forfeit').classList.remove('hidden'); }
function hideAllPanels() { $$('.dock .panel').forEach(p => p.classList.add('hidden')); }
function showPanel(id) { $('#' + id).classList.remove('hidden'); }

function renderLobby(room, me) {
  showPanel('lobby-panel');
  $('#lobby-pool').textContent = fmt(room.prizePool);
  const ready = room.players.filter(p => p.anted && !p.spectator);
  $('#lobby-count').textContent = ready.length;
  const lp = $('#lobby-players'); lp.innerHTML = '';
  for (const p of room.players) {
    const chip = document.createElement('div'); chip.className = 'lobby-chip' + (p.anted ? ' ready' : '');
    chip.innerHTML = `${p.isHost ? `<span class="crown">${ic('crown')}</span>` : ''}${esc(p.name)}${p.spectator ? ' 👁' : ''}`;
    lp.appendChild(chip);
  }
  const isHost = me.isHost;
  $('#btn-start-match').classList.toggle('hidden', !isHost || ready.length < 1);
  $('#lobby-wait').classList.toggle('hidden', isHost);
  $('#lobby-wait').textContent = isHost ? '' : 'Warte auf Host zum Start…';
}
$('#btn-start-match').addEventListener('click', () => { state.socket.emit('startMatch'); Sound.button(); });
$('#btn-forfeit').addEventListener('click', () => { if (confirm('Turnier aufgeben? Dein Buy-in ist verloren.')) { state.socket.emit('forfeit'); Sound.button(); } });

function updateActionButtons(room, me) {
  const hand = me.hands[room.activeHandIndex]; if (!hand) return; const s = room.settings;
  const two = hand.cards.length === 2;
  $('.act-double').disabled = !(two && me.chips >= hand.bet && (!hand.isSplit || s.doubleAfterSplit));
  $('.act-split').disabled = !(two && hand.cards[0].value === hand.cards[1].value && me.hands.length < 4 && me.chips >= hand.bet);
  $('.act-surr').disabled = !(s.surrenderAllowed && two && !hand.isSplit);
}

/* ============================ BETTING ============================ */
const CHIP_VALUES = [5, 25, 100, 500, 1000];
function buildChipRack() { const rack = $('#chip-rack'); rack.innerHTML = ''; for (const v of CHIP_VALUES) { const c = document.createElement('button'); c.className = 'chip'; c.dataset.v = v; c.innerHTML = `<span>${v >= 1000 ? '1K' : v}</span>`; c.addEventListener('click', () => addChip(v)); rack.appendChild(c); } }
function addChip(v) {
  const me = myPlayer(); if (!me || state.room.phase !== 'betting' || me.eliminated || me.spectator) return;
  const pend = state.pendingBet.amount + state.pendingBet.perfectPairs + state.pendingBet.twentyOnePlus3;
  if (pend + v > me.chips) { toast('Nicht genug Chips', 'bad'); vibrate(40); return; }
  if (state.activeSideBet) state.pendingBet[state.activeSideBet] += v; else state.pendingBet.amount += v;
  Sound.chip(); vibrate(8); syncBetUI(); sendBet();
}
function sendBet() { state.socket.emit('placeBet', { amount: state.pendingBet.amount, perfectPairs: state.pendingBet.perfectPairs, twentyOnePlus3: state.pendingBet.twentyOnePlus3 }); }
$('#btn-clearbet').addEventListener('click', () => { state.pendingBet = { amount: 0, perfectPairs: 0, twentyOnePlus3: 0 }; state.activeSideBet = null; state.socket.emit('clearBet'); syncBetUI(); Sound.button(); });
$('#btn-deal').addEventListener('click', () => { state.socket.emit('deal'); Sound.button(); });
$('#btn-rebuy').addEventListener('click', () => { state.socket.emit('rebuy'); Sound.chip(); });
$$('.sb-btn').forEach(b => b.addEventListener('click', () => { const sb = b.dataset.sb; state.activeSideBet = state.activeSideBet === sb ? null : sb; Sound.button(); syncBetUI(); }));
function syncBetUI() {
  const me = myPlayer(); const room = state.room;
  $('#my-chips').textContent = me ? fmt(me.chips) : 0;
  $('#bet-current').textContent = fmt(state.pendingBet.amount);
  $('#sb-pp').textContent = state.pendingBet.perfectPairs; $('#sb-t3').textContent = state.pendingBet.twentyOnePlus3;
  $$('.sb-btn').forEach(b => { const sb = b.dataset.sb; b.classList.toggle('armed', state.activeSideBet === sb || state.pendingBet[sb] > 0); });
  if (!room) return; const s = room.settings; const sbRow = $('#sidebet-row');
  sbRow.classList.toggle('hidden', !s.sideBetsEnabled);
  sbRow.querySelector('[data-sb="perfectPairs"]').classList.toggle('hidden', !s.allowPerfectPairs);
  sbRow.querySelector('[data-sb="twentyOnePlus3"]').classList.toggle('hidden', !s.allow21p3);
  $('#bet-hint').textContent = state.activeSideBet ? `Chips → ${state.activeSideBet === 'perfectPairs' ? 'Perfect Pairs' : '21+3'}` : `Min ${fmt(s.minBet)} · Max ${fmt(s.maxBet)} · BJ zahlt ${s.blackjackPayout === 1.5 ? '3:2' : '6:5'}`;
  const isHost = me && me.isHost;
  $('#btn-deal').classList.toggle('hidden', !isHost);
  $('#btn-rebuy').classList.toggle('hidden', !(me && room.mode === 'cash' && me.chips <= 0 && state.pendingBet.amount === 0));
}

/* ============================ ACTIONS ============================ */
$$('.act-btn').forEach(b => b.addEventListener('click', () => { state.socket.emit('action', { type: b.dataset.act }); Sound.button(); vibrate(12); }));
$('#btn-ins-yes').addEventListener('click', () => { state.socket.emit('insurance', { take: true }); Sound.chip(); $('#insurance-panel').classList.add('hidden'); });
$('#btn-ins-no').addEventListener('click', () => { state.socket.emit('insurance', { take: false }); Sound.button(); $('#insurance-panel').classList.add('hidden'); });

/* ============================ TOPBAR ============================ */
$('#btn-leave').addEventListener('click', () => { if (confirm('Tisch verlassen?')) { state.socket.emit('leaveRoom'); state.room = null; state.me = null; state.lastSeenCards = {}; showScreen('screen-hub'); setTimeout(() => { refreshMe(); loadHub(); }, 500); } });
$('#btn-copy').addEventListener('click', () => { const code = state.room && state.room.code; if (!code) return; const url = location.origin + '/#' + code; if (navigator.clipboard) navigator.clipboard.writeText(url); toast('Einladungslink kopiert!', 'good', false, 'copy'); Sound.button(); });
$('#btn-settings').addEventListener('click', () => { openSettings(); Sound.button(); });
$('#btn-board').addEventListener('click', () => { openBoard(); Sound.button(); });

/* ============================ TIMER ============================ */
function renderTimer(room) {
  const ring = $('#timer-ring'), fg = $('#tr-fg'), txt = $('#timer-text');
  const me = myPlayer();
  const show = (room.phase === 'betting' && room.settings.autoStart && me && !me.eliminated && !me.spectator) ||
    (room.phase === 'playerTurns' && room.activePlayerId === state.me) ||
    (room.phase === 'insurance' && me && me.bet > 0);
  if (!show || !room.timerEndsAt) { ring.classList.remove('show'); if (state.timerRAF) { cancelAnimationFrame(state.timerRAF); state.timerRAF = null; } return; }
  ring.classList.add('show');
  const drift = room.serverNow - Date.now();
  const total = room.phase === 'betting' ? room.settings.betTimer : (room.phase === 'insurance' ? 12 : room.settings.turnTimer);
  const C = 2 * Math.PI * 34;
  const tick = () => {
    const remain = Math.max(0, room.timerEndsAt - (Date.now() + drift));
    const frac = Math.min(1, remain / (total * 1000));
    fg.style.strokeDasharray = C; fg.style.strokeDashoffset = C * (1 - frac);
    fg.style.stroke = frac < .3 ? '#ff5d6c' : (frac < .6 ? '#ffd76a' : '#28d695');
    txt.textContent = Math.ceil(remain / 1000);
    if (remain > 0 && ring.classList.contains('show')) state.timerRAF = requestAnimationFrame(tick);
  };
  if (state.timerRAF) cancelAnimationFrame(state.timerRAF); tick();
}

/* ============================ FX EVENTS ============================ */
function onFx(e) {
  switch (e.type) {
    case 'deal': Sound.deal(); vibrate(6); break;
    case 'shuffle': toast('Karten gemischt', '', false, 'refresh'); break;
    case 'bettingOpen': resetBetUI(); break;
    case 'hit': Sound.hit(); vibrate(8); break;
    case 'double': Sound.chip(); toast('DOUBLE!', 'gold'); break;
    case 'split': Sound.chip(); toast('SPLIT!', 'gold'); break;
    case 'revealHole': Sound.flip(); break;
    case 'dealerHit': Sound.deal(); break;
    case 'turn': if (e.playerId === state.me) { Sound.turn(); vibrate([20, 40, 20]); toast('Du bist dran!', 'good'); } break;
    case 'autoStand': if (e.playerId === state.me) toast('Zeit abgelaufen – Stand', 'bad'); break;
    case 'insuranceTaken': toast('Versichert: ' + e.amount, 'good', false, 'shield'); break;
    case 'insuranceWin': toast('Versicherung +' + e.amount, 'good', false, 'shield'); FX.burst(innerWidth / 2, innerHeight / 2, 30); break;
    case 'insuranceLose': toast('Versicherung verloren', 'bad'); break;
    case 'dealerBlackjack': toast('Dealer Blackjack!', 'bad', true); break;
    case 'sideBetResult': handleSideBet(e); break;
    case 'rebuy': toast('Rebuy! +' + fmt(e.amount), 'gold', false, 'refresh'); FX.burst(innerWidth / 2, innerHeight - 200, 40); break;
    case 'playerJoined': toast(e.name + ' ist beigetreten', 'good', false, 'user'); break;
    case 'playerLeft': toast(e.name + ' hat verlassen', ''); break;
    case 'matchStart': toast('Turnier startet!', 'gold', true, 'bolt'); FX.rain(); break;
    case 'eliminated': Sound.elim(); toast((e.playerId === state.me ? 'Du bist' : e.name) + ' ausgeschieden', 'bad', e.playerId === state.me, 'skull'); if (e.playerId === state.me) vibrate([100, 50, 100]); break;
    case 'forfeit': toast(e.name + ' hat aufgegeben', ''); break;
    case 'matchOver': showMatchOver(e); break;
    case 'settingsUpdated': toast('Einstellungen geändert', '', false, 'settings'); break;
    case 'emote': onEmote(e.playerId, e.emoji); break;
    case 'payout': handlePayout(e); break;
    case 'noBets': break;
  }
}
function handleSideBet(e) { for (const r of e.results) if (r.win) { toast(`${r.name}: ${r.label} +${fmt(r.amount)}`, 'gold', true, 'star'); FX.burst(innerWidth / 2, innerHeight / 2, 50); Sound.win(); } }
function handlePayout(e) {
  const mine = e.summary.find(s => s.playerId === state.me);
  if (mine) {
    const seat = $(`.seat[data-pid="${state.me}"]`);
    if (mine.net > 0) {
      if (mine.results.includes('blackjack')) { Sound.blackjack(); toast('BLACKJACK! +' + fmt(mine.net), 'gold', true, 'star'); FX.rain(); vibrate([30, 60, 30, 60, 60]); }
      else { Sound.win(); toast('Gewonnen +' + fmt(mine.net), 'good', true); FX.burst(innerWidth / 2, innerHeight / 2, 70); vibrate([20, 50, 20]); }
      popDelta(seat, '+' + fmt(mine.net), true);
    } else if (mine.net < 0) { if (mine.results.includes('bust')) Sound.bust(); else Sound.lose(); toast(fmt(mine.net), 'bad'); vibrate(120); popDelta(seat, fmt(mine.net), false); }
    else { Sound.push(); toast('Push – Einsatz zurück', ''); }
  }
  const winner = [...e.summary].sort((a, b) => b.net - a.net)[0];
  if (winner && winner.net > 0 && winner.playerId !== state.me) toast(`${winner.name} +${fmt(winner.net)}`, '', false, 'trophy');
}
function popDelta(seat, text, plus) { if (!seat) return; const d = document.createElement('div'); d.className = 'delta-pop ' + (plus ? 'plus' : 'minus'); d.textContent = text; seat.appendChild(d); setTimeout(() => d.remove(), 1800); }
function resetBetUI() { state.pendingBet = { amount: 0, perfectPairs: 0, twentyOnePlus3: 0 }; state.activeSideBet = null; syncBetUI(); }
function showMatchOver(e) {
  Sound.fanfare(); FX.rain();
  const won = e.winner && store.account && e.winner === store.account.username;
  $('#win-name').textContent = e.winner || 'Niemand';
  $('#win-pot').textContent = fmt(e.pool);
  $('#match-over').classList.add('open');
  if (won) { vibrate([40, 60, 40, 60, 120]); setTimeout(() => FX.burst(innerWidth / 2, innerHeight / 2, 90), 300); }
  // refresh account money after a moment
  setTimeout(refreshMe, 800);
}
$('#btn-win-close').addEventListener('click', () => { $('#match-over').classList.remove('open'); Sound.button(); });
async function refreshMe() { try { const r = await fetch('/api/me', { headers: authHeader() }); if (r.ok) { store.account = (await r.json()).account; renderProfile(); } } catch {} }

/* ============================ EMOTES ============================ */
function buildEmotePopup() { const pop = $('#emote-popup'); pop.innerHTML = ''; for (const name of ICON.EMOTE_LIST) { const b = document.createElement('button'); b.innerHTML = ICON.emote(name); b.addEventListener('click', () => { state.socket.emit('emote', { emoji: name }); pop.classList.remove('open'); vibrate(8); Sound.button(); }); pop.appendChild(b); } }
$('#emote-fab').addEventListener('click', () => { $('#emote-popup').classList.toggle('open'); $('#chat-panel').classList.remove('open'); Sound.button(); });
function onEmote(playerId, name) { const seat = $(`.seat[data-pid="${playerId}"]`); if (!seat) return; const b = document.createElement('div'); b.className = 'emote-bubble'; b.innerHTML = ICON.emote(name); seat.appendChild(b); setTimeout(() => b.remove(), 3400); }

/* ============================ CHAT ============================ */
$('#chat-fab').addEventListener('click', () => { $('#chat-panel').classList.toggle('open'); $('#emote-popup').classList.remove('open'); Sound.button(); });
$('#chat-close').addEventListener('click', () => $('#chat-panel').classList.remove('open'));
$('#chat-send').addEventListener('click', sendChat);
$('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
function sendChat() { const inp = $('#chat-input'); const msg = inp.value.trim(); if (!msg) return; state.socket.emit('chat', { msg }); inp.value = ''; }
function onChat(m) { const log = $('#chat-log'); const el = document.createElement('div'); el.className = 'chat-msg' + (m.playerId === state.me ? ' me' : ''); el.innerHTML = `<b>${esc(m.name)}:</b> ${esc(m.msg)}`; log.appendChild(el); log.scrollTop = log.scrollHeight; if (!$('#chat-panel').classList.contains('open')) $('#chat-fab').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 300 }); }

/* ============================ SETTINGS ============================ */
const SETTINGS_SCHEMA = [
  { key: 'decks', label: 'Anzahl Decks', desc: 'Karten im Schuh', type: 'num', min: 1, max: 8 },
  { key: 'blackjackPayout', label: 'Blackjack-Auszahlung', desc: '3:2 ist fairer', type: 'seg', options: [[1.5, '3:2'], [1.2, '6:5']] },
  { key: 'dealerHitsSoft17', label: 'Dealer zieht bei Soft 17', type: 'toggle' },
  { key: 'startingChips', label: 'Start-Chips', desc: 'nur Freies Spiel', type: 'num', min: 100, max: 1000000 },
  { key: 'minBet', label: 'Min. Einsatz', type: 'num', min: 1, max: 100000 },
  { key: 'maxBet', label: 'Max. Einsatz', type: 'num', min: 1, max: 1000000 },
  { key: 'maxPlayers', label: 'Max. Spieler', type: 'num', min: 1, max: 7 },
  { key: 'turnTimer', label: 'Zug-Timer (Sek.)', type: 'num', min: 8, max: 120 },
  { key: 'betTimer', label: 'Einsatz-Timer (Sek.)', type: 'num', min: 8, max: 120 },
  { key: 'sideBetsEnabled', label: 'Side Bets aktiv', type: 'toggle' },
  { key: 'allowPerfectPairs', label: '↳ Perfect Pairs', desc: 'bis 25:1', type: 'toggle', dep: 'sideBetsEnabled' },
  { key: 'allow21p3', label: '↳ 21+3', desc: 'bis 100:1', type: 'toggle', dep: 'sideBetsEnabled' },
  { key: 'allowInsurance', label: 'Versicherung', type: 'toggle' },
  { key: 'surrenderAllowed', label: 'Surrender', type: 'toggle' },
  { key: 'doubleAfterSplit', label: 'Double nach Split', type: 'toggle' },
];
let draftSettings = null;
function openSettings() {
  const room = state.room; if (!room) return; const me = myPlayer(); const isHost = me && me.isHost && !room.matchActive;
  draftSettings = { ...room.settings };
  const body = $('#settings-body'); body.innerHTML = '';
  for (const f of SETTINGS_SCHEMA) {
    const row = document.createElement('div'); row.className = 'set-row';
    if ((f.dep && !draftSettings[f.dep]) || !isHost) row.classList.add('locked');
    row.innerHTML = `<div><label>${f.label}</label>${f.desc ? `<small>${f.desc}</small>` : ''}</div>`;
    const ctrl = document.createElement('div'); ctrl.className = 'set-control';
    if (f.type === 'num') { const inp = document.createElement('input'); inp.type = 'number'; inp.className = 'num-input'; inp.value = draftSettings[f.key]; inp.min = f.min; inp.max = f.max; inp.addEventListener('input', () => draftSettings[f.key] = parseInt(inp.value, 10) || f.min); ctrl.appendChild(inp); }
    else if (f.type === 'toggle') { const tg = document.createElement('div'); tg.className = 'toggle' + (draftSettings[f.key] ? ' on' : ''); tg.addEventListener('click', () => { if (!isHost) return; draftSettings[f.key] = !draftSettings[f.key]; tg.classList.toggle('on', draftSettings[f.key]); if (f.key === 'sideBetsEnabled') openSettings(); }); ctrl.appendChild(tg); }
    else if (f.type === 'seg') { const seg = document.createElement('div'); seg.className = 'seg'; for (const [val, lbl] of f.options) { const b = document.createElement('button'); b.textContent = lbl; if (draftSettings[f.key] === val) b.classList.add('on'); b.addEventListener('click', () => { if (!isHost) return; draftSettings[f.key] = val; $$('button', seg).forEach(x => x.classList.remove('on')); b.classList.add('on'); }); seg.appendChild(b); } ctrl.appendChild(seg); }
    row.appendChild(ctrl); body.appendChild(row);
  }
  $('#host-note').textContent = !me ? '' : (room.matchActive ? 'Während eines Turniers gesperrt' : (me.isHost ? 'Du bist Host' : 'Nur der Host kann ändern'));
  $('#btn-save-settings').classList.toggle('hidden', !isHost);
  $('#modal-settings').classList.add('open');
}
$('#btn-save-settings').addEventListener('click', () => { state.socket.emit('updateSettings', draftSettings); $('#modal-settings').classList.remove('open'); Sound.button(); });

/* ============================ TABLE BOARD ============================ */
function openBoard() {
  const room = state.room; if (!room) return; const body = $('#board-body'); body.innerHTML = '';
  const sorted = [...room.players].sort((a, b) => b.chips - a.chips);
  sorted.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'board-row rank-' + (i + 1) + (p.id === state.me ? ' me' : '');
    const medal = i < 3 ? `<span class="medal">${ic('medal')}</span>` : (i + 1);
    row.innerHTML = `<div class="board-rank">${medal}</div><div class="board-name">${esc(p.name)}${p.id === state.me ? ' (Du)' : ''}${p.eliminated ? ' · RAUS' : ''}<small>${p.stats.wins}S · ${p.stats.losses}N · ${p.stats.blackjacks} BJ</small></div><div class="board-chips"><span class="mini-icon">${ic('coins')}</span>${fmt(p.chips)}</div>`;
    body.appendChild(row);
  });
  $('#modal-board').classList.add('open');
}
$$('[data-close]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.close).classList.remove('open')));
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

/* ============================ INIT ============================ */
ICON.hydrate(document);
buildChipRack();
buildEmotePopup();
tryResume();
})();
