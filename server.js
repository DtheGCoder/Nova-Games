/* =========================================================================
   NOVA CASINO — Multiplayer server (Express + Socket.IO)
   Accounts + auth (30-day sessions), global money, hub/leaderboard,
   Blackjack with cash & tournament (elimination) modes.
   Persistence: flat JSON files under ./data (no external DB).
   ========================================================================= */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3524;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SESSION_DAYS = 30;

/* =============================== STORAGE ================================ */
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
let accounts = loadJSON(ACCOUNTS_FILE, {}); // username(lower) -> account
let tokens = loadJSON(TOKENS_FILE, {});     // token -> {username, expires}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts));
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens));
    } catch (e) { console.error('persist failed', e); }
  }, 400);
}

/* purge expired tokens at boot */
(() => { const now = Date.now(); let ch = false;
  for (const t in tokens) if (tokens[t].expires < now) { delete tokens[t]; ch = true; }
  if (ch) persist();
})();

/* =============================== ACCOUNTS ============================== */
function hashPw(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function makeAccount(username, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    username,
    salt,
    hash: hashPw(password, salt),
    money: 5000,
    created: Date.now(),
    stats: { matchesWon: 0, matchesPlayed: 0, handsWon: 0, handsLost: 0, pushes: 0,
      blackjacks: 0, biggestPot: 0, bestStreak: 0 },
    isAdmin: false,
  };
}
function verifyPw(account, password) {
  const h = hashPw(password, account.salt);
  const a = Buffer.from(h, 'hex'), b = Buffer.from(account.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newToken(username) {
  const token = crypto.randomBytes(24).toString('hex');
  tokens[token] = { username, expires: Date.now() + SESSION_DAYS * 864e5 };
  persist();
  return token;
}
function accountByToken(token) {
  const t = token && tokens[token];
  if (!t || t.expires < Date.now()) return null;
  return accounts[t.username.toLowerCase()] || null;
}
function publicAccount(a) {
  if (!a) return null;
  return { username: a.username, money: a.money, stats: a.stats, created: a.created, isAdmin: !!a.isAdmin };
}
const validName = s => typeof s === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(s);

/* bootstrap admin account (Damian). Created with default pw if missing; always flagged admin. */
const ADMIN_USER = process.env.ADMIN_USER || 'Damian';
const ADMIN_PW = process.env.ADMIN_PW || '0815';
(function ensureAdmin() {
  const key = ADMIN_USER.toLowerCase();
  if (!accounts[key]) accounts[key] = makeAccount(ADMIN_USER, ADMIN_PW);
  accounts[key].isAdmin = true;
  persist();
})();

/* =============================== EXPRESS =============================== */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public'), { etag: true, maxAge: 0 }));

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const acc = accountByToken(token);
  if (!acc) return res.status(401).json({ error: 'unauthorized' });
  req.account = acc; req.token = token; next();
}
function adminMiddleware(req, res, next) {
  if (!req.account || !req.account.isAdmin) return res.status(403).json({ error: 'forbidden', message: 'Keine Adminrechte' });
  next();
}

app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!validName(username)) return res.status(400).json({ error: 'bad_username', message: '3-16 Zeichen: A-Z, 0-9, _' });
  if (typeof password !== 'string' || password.length < 4) return res.status(400).json({ error: 'bad_password', message: 'Mind. 4 Zeichen' });
  const key = username.toLowerCase();
  if (accounts[key]) return res.status(409).json({ error: 'taken', message: 'Name bereits vergeben' });
  accounts[key] = makeAccount(username, password);
  persist();
  const token = newToken(username);
  res.json({ token, account: publicAccount(accounts[key]) });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const acc = accounts[(username || '').toLowerCase()];
  if (!acc || !verifyPw(acc, password || '')) return res.status(401).json({ error: 'invalid', message: 'Falscher Name oder Passwort' });
  const token = newToken(acc.username);
  res.json({ token, account: publicAccount(acc) });
});

app.post('/api/logout', authMiddleware, (req, res) => { delete tokens[req.token]; persist(); res.json({ ok: true }); });

app.get('/api/me', authMiddleware, (req, res) => res.json({ account: publicAccount(req.account) }));

app.post('/api/bonus', authMiddleware, (req, res) => {
  // top-up for broke players so they can keep playing
  if (req.account.money < 1000) { req.account.money = 1000; persist(); }
  res.json({ account: publicAccount(req.account) });
});

app.get('/api/leaderboard', (req, res) => {
  const list = Object.values(accounts)
    .map(a => ({ username: a.username, money: a.money, matchesWon: a.stats.matchesWon, blackjacks: a.stats.blackjacks }))
    .sort((x, y) => y.money - x.money).slice(0, 50);
  res.json({ leaderboard: list, totalPlayers: Object.keys(accounts).length });
});

/* ------------------------------- ADMIN -------------------------------- */
app.get('/api/admin/players', authMiddleware, adminMiddleware, (req, res) => {
  const players = Object.values(accounts).map(a => ({
    username: a.username, money: a.money, isAdmin: !!a.isAdmin, created: a.created,
    online: isOnline(a.username), stats: a.stats,
  })).sort((x, y) => y.money - x.money);
  res.json({ players });
});
app.post('/api/admin/money', authMiddleware, adminMiddleware, (req, res) => {
  const { username, money } = req.body || {};
  const acc = accounts[(username || '').toLowerCase()];
  if (!acc) return res.status(404).json({ error: 'not_found' });
  const m = parseInt(money, 10);
  if (!Number.isFinite(m) || m < 0 || m > 1e12) return res.status(400).json({ error: 'bad_value' });
  acc.money = m; persist(); pushAccountUpdate(acc);
  res.json({ ok: true, account: publicAccount(acc) });
});
app.post('/api/admin/password', authMiddleware, adminMiddleware, (req, res) => {
  const { username, password } = req.body || {};
  const acc = accounts[(username || '').toLowerCase()];
  if (!acc) return res.status(404).json({ error: 'not_found' });
  if (typeof password !== 'string' || password.length < 4) return res.status(400).json({ error: 'bad_password', message: 'Mind. 4 Zeichen' });
  acc.salt = crypto.randomBytes(16).toString('hex'); acc.hash = hashPw(password, acc.salt);
  // invalidate that user's sessions
  for (const t in tokens) if (tokens[t].username.toLowerCase() === acc.username.toLowerCase()) delete tokens[t];
  persist();
  res.json({ ok: true });
});
app.post('/api/admin/setAdmin', authMiddleware, adminMiddleware, (req, res) => {
  const { username, isAdmin } = req.body || {};
  const acc = accounts[(username || '').toLowerCase()];
  if (!acc) return res.status(404).json({ error: 'not_found' });
  if (acc.username.toLowerCase() === ADMIN_USER.toLowerCase()) return res.status(400).json({ error: 'protected', message: 'Haupt-Admin kann nicht geändert werden' });
  acc.isAdmin = !!isAdmin; persist();
  res.json({ ok: true });
});
app.post('/api/admin/delete', authMiddleware, adminMiddleware, (req, res) => {
  const { username } = req.body || {};
  const key = (username || '').toLowerCase();
  const acc = accounts[key];
  if (!acc) return res.status(404).json({ error: 'not_found' });
  if (key === req.account.username.toLowerCase()) return res.status(400).json({ error: 'self', message: 'Du kannst dich nicht selbst löschen' });
  if (key === ADMIN_USER.toLowerCase()) return res.status(400).json({ error: 'protected', message: 'Haupt-Admin geschützt' });
  delete accounts[key];
  for (const t in tokens) if (tokens[t].username.toLowerCase() === key) delete tokens[t];
  persist();
  res.json({ ok: true });
});

app.get('/api/games', (req, res) => {
  let bjPlayers = 0, bjRooms = 0;
  for (const r of rooms.values()) { bjRooms++; bjPlayers += r.players.size; }
  res.json({ games: [
    { id: 'blackjack', name: 'Blackjack', tagline: 'Multiplayer · Side Bets · Turniere', status: 'live', online: bjPlayers, rooms: bjRooms },
    { id: 'poker', name: 'Texas Hold’em', tagline: 'Bald verfügbar', status: 'soon', online: 0 },
    { id: 'roulette', name: 'Roulette', tagline: 'Bald verfügbar', status: 'soon', online: 0 },
    { id: 'slots', name: 'Mega Slots', tagline: 'Bald verfügbar', status: 'soon', online: 0 },
  ] });
});

app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size, accounts: Object.keys(accounts).length, ts: Date.now() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, pingInterval: 20000, pingTimeout: 25000 });

/* socket auth */
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  const acc = accountByToken(token);
  if (!acc) return next(new Error('unauthorized'));
  socket.data.username = acc.username;
  next();
});
function sockAccount(socket) { return accounts[(socket.data.username || '').toLowerCase()] || null; }
function socketsOf(username) { const out = []; const u = (username || '').toLowerCase(); for (const [, s] of io.of('/').sockets) if (s.data.username && s.data.username.toLowerCase() === u) out.push(s); return out; }
function isOnline(username) { return socketsOf(username).length > 0; }
function pushAccountUpdate(acc) { for (const s of socketsOf(acc.username)) s.emit('account', publicAccount(acc)); }

/* ============================== CARDS ================================= */
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const cardValue = r => r === 'A' ? 11 : (r === 'K' || r === 'Q' || r === 'J' ? 10 : parseInt(r, 10));
const isRed = s => s === 'H' || s === 'D';
const rankIndex = r => RANKS.indexOf(r);

function buildShoe(decks) {
  const shoe = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS)
    shoe.push({ rank: r, suit: s, value: cardValue(r), id: `${r}${s}${d}${Math.random().toString(36).slice(2, 6)}` });
  for (let i = shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
  return shoe;
}
function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += c.value; if (c.rank === 'A') aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
const isBlackjack = c => c.length === 2 && handValue(c).total === 21;

function evalPerfectPairs(c1, c2) {
  if (c1.rank !== c2.rank) return { win: false, mult: 0, label: '' };
  if (c1.suit === c2.suit) return { win: true, mult: 25, label: 'Perfect Pair' };
  if (isRed(c1.suit) === isRed(c2.suit)) return { win: true, mult: 12, label: 'Colored Pair' };
  return { win: true, mult: 6, label: 'Mixed Pair' };
}
function evalTwentyOnePlus3(c1, c2, up) {
  const cards = [c1, c2, up], ranks = cards.map(c => c.rank), suits = cards.map(c => c.suit);
  const allSuit = suits[0] === suits[1] && suits[1] === suits[2];
  const allRank = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const idx = cards.map(c => rankIndex(c.rank)).sort((a, b) => a - b);
  const consec = idx[1] === idx[0] + 1 && idx[2] === idx[1] + 1;
  const set = new Set(ranks); const wheel = set.has('A') && set.has('2') && set.has('3');
  const straight = consec || wheel;
  if (allRank && allSuit) return { win: true, mult: 100, label: 'Suited Trips' };
  if (straight && allSuit) return { win: true, mult: 40, label: 'Straight Flush' };
  if (allRank) return { win: true, mult: 30, label: 'Three of a Kind' };
  if (straight) return { win: true, mult: 10, label: 'Straight' };
  if (allSuit) return { win: true, mult: 5, label: 'Flush' };
  return { win: false, mult: 0, label: '' };
}

/* ============================== SETTINGS ============================== */
const DEFAULT_SETTINGS = {
  mode: 'cash',              // 'cash' | 'tournament'
  buyIn: 1000,               // tournament ante (from account money)
  decks: 6,
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  startingChips: 1000,
  minBet: 10,
  maxBet: 500,
  sideBetsEnabled: true,
  allowPerfectPairs: true,
  allow21p3: true,
  allowInsurance: true,
  surrenderAllowed: true,
  doubleAfterSplit: true,
  turnTimer: 25,
  betTimer: 22,
  maxPlayers: 6,
  autoStart: true,
};
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function sanitizeSettings(s) {
  const o = { ...DEFAULT_SETTINGS, ...(s || {}) };
  o.mode = o.mode === 'tournament' ? 'tournament' : 'cash';
  o.buyIn = clamp(int(o.buyIn, 1000), 100, 1000000);
  o.decks = clamp(int(o.decks, 6), 1, 8);
  o.blackjackPayout = Number(o.blackjackPayout) === 1.2 ? 1.2 : 1.5;
  o.startingChips = clamp(int(o.startingChips, 1000), 100, 1000000);
  o.minBet = clamp(int(o.minBet, 10), 1, 100000);
  o.maxBet = clamp(int(o.maxBet, 500), o.minBet, 1000000);
  o.turnTimer = clamp(int(o.turnTimer, 25), 8, 120);
  o.betTimer = clamp(int(o.betTimer, 22), 8, 120);
  o.maxPlayers = clamp(int(o.maxPlayers, 6), 1, 7);
  for (const k of ['dealerHitsSoft17', 'sideBetsEnabled', 'allowPerfectPairs', 'allow21p3',
    'allowInsurance', 'surrenderAllowed', 'doubleAfterSplit', 'autoStart']) o[k] = !!o[k];
  if (o.mode === 'tournament') { o.startingChips = o.buyIn; o.autoStart = true; }
  return o;
}

/* =============================== ROOMS ================================ */
const rooms = new Map();
function makeCode() {
  const ab = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c;
  do { c = ''; for (let i = 0; i < 4; i++) c += ab[Math.floor(Math.random() * ab.length)]; } while (rooms.has(c));
  return c;
}
function createRoom(settings) {
  const code = makeCode();
  const room = {
    code, hostId: null, settings: sanitizeSettings(settings),
    players: new Map(), seatOrder: [],
    phase: 'lobby', shoe: [], dealer: { cards: [], hideHole: true },
    activePlayerId: null, activeHandIndex: 0, turnOrder: [], turnPointer: 0,
    round: 0, timer: null, timerEndsAt: 0,
    matchActive: false, prizePool: 0, winner: null,
  };
  rooms.set(code, room);
  return room;
}
function newPlayer(socket) {
  const acc = sockAccount(socket);
  return {
    id: socket.id, socketId: socket.id, account: acc.username,
    name: acc.username, seat: -1, connected: true,
    chips: 0, bet: 0, sideBets: { perfectPairs: 0, twentyOnePlus3: 0 },
    insuranceBet: 0, insuranceResolved: false, insuranceAnswered: false, hands: [], activeHand: 0, hasBet: false,
    eliminated: false, spectator: false, anted: false,
    stats: { wins: 0, losses: 0, pushes: 0, blackjacks: 0, streak: 0, bestStreak: 0, netRound: 0 },
    lastDelta: 0, emote: null, emoteAt: 0,
  };
}

/* ========================= STATE SERIALIZATION ======================== */
function publicState(room) {
  const players = room.seatOrder.map(pid => {
    const p = room.players.get(pid); if (!p) return null;
    return {
      id: p.id, name: p.name, account: p.account, chips: p.chips, seat: p.seat,
      connected: p.connected, bet: p.bet, sideBets: p.sideBets, insuranceBet: p.insuranceBet,
      hands: p.hands.map(h => ({ cards: h.cards, bet: h.bet, done: h.done, result: h.result,
        isSplit: h.isSplit, doubled: h.doubled, surrendered: h.surrendered, blackjack: h.blackjack,
        value: handValue(h.cards) })),
      activeHand: p.activeHand, hasBet: p.hasBet, insuranceAnswered: p.insuranceAnswered, stats: p.stats, lastDelta: p.lastDelta,
      eliminated: p.eliminated, spectator: p.spectator, anted: p.anted,
      emote: (p.emote && Date.now() - p.emoteAt < 3500) ? p.emote : null,
      isHost: room.hostId === p.id,
    };
  }).filter(Boolean);
  const dealerCards = room.dealer.cards.map((c, i) => (room.dealer.hideHole && i === 1) ? { hidden: true } : c);
  return {
    code: room.code, phase: room.phase, settings: room.settings, hostId: room.hostId,
    mode: room.settings.mode, matchActive: room.matchActive, prizePool: room.prizePool, winner: room.winner,
    dealer: { cards: dealerCards, value: room.dealer.hideHole ? null : handValue(room.dealer.cards), hideHole: room.dealer.hideHole },
    activePlayerId: room.activePlayerId, activeHandIndex: room.activeHandIndex, round: room.round,
    players, timerEndsAt: room.timerEndsAt, serverNow: Date.now(), shoeLeft: room.shoe.length,
  };
}
const broadcast = room => io.to(room.code).emit('state', publicState(room));
const fx = (room, p) => io.to(room.code).emit('fx', p);
const fxTo = (sid, p) => io.to(sid).emit('fx', p);

/* =============================== TIMERS =============================== */
function clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } room.timerEndsAt = 0; }
function setPhaseTimer(room, sec, cb) {
  clearTimer(room); room.timerEndsAt = Date.now() + sec * 1000;
  room.timer = setTimeout(() => { room.timer = null; room.timerEndsAt = 0; cb(); }, sec * 1000);
}

/* =========================== ROUND LIFECYCLE ========================== */
function ensureShoe(room) {
  if (room.shoe.length === 0 || room.shoe.length < room.settings.decks * 52 * 0.25) {
    room.shoe = buildShoe(room.settings.decks); fx(room, { type: 'shuffle' });
  }
}
function draw(room) { if (room.shoe.length === 0) room.shoe = buildShoe(room.settings.decks); return room.shoe.pop(); }
function seatedPlayersInOrder(room) { return room.seatOrder.map(pid => room.players.get(pid)).filter(p => p && p.seat >= 0); }
function eligiblePlayers(room) { return seatedPlayersInOrder(room).filter(p => !p.eliminated && !p.spectator); }

function startBetting(room) {
  room.phase = 'betting'; room.round += 1;
  room.dealer = { cards: [], hideHole: true };
  room.activePlayerId = null; room.activeHandIndex = 0; room.turnOrder = []; room.turnPointer = 0;
  ensureShoe(room);
  for (const p of room.players.values()) {
    p.bet = 0; p.sideBets = { perfectPairs: 0, twentyOnePlus3: 0 };
    p.insuranceBet = 0; p.insuranceResolved = false; p.insuranceAnswered = false; p.hands = []; p.activeHand = 0;
    p.hasBet = false; p.lastDelta = 0;
  }
  broadcast(room); fx(room, { type: 'bettingOpen' });
  if (room.settings.autoStart) setPhaseTimer(room, room.settings.betTimer, () => beginDeal(room));
}

function beginDeal(room) {
  clearTimer(room);
  const bettors = eligiblePlayers(room).filter(p => p.hasBet && p.bet > 0);
  if (bettors.length === 0) {
    // nobody bet: in tournament keep waiting; in cash restart betting
    if (room.matchActive && room.settings.mode === 'tournament') { startBetting(room); }
    else { fx(room, { type: 'noBets' }); startBetting(room); }
    return;
  }
  room.phase = 'dealing';
  for (const p of bettors) { p.hands = [{ cards: [], bet: p.bet, done: false, result: null, isSplit: false, doubled: false, surrendered: false, blackjack: false }]; p.activeHand = 0; }
  room.dealer = { cards: [], hideHole: true };
  broadcast(room);
  const steps = [];
  for (const p of bettors) steps.push({ to: p.id });
  steps.push({ to: 'dealer' });
  for (const p of bettors) steps.push({ to: p.id });
  steps.push({ to: 'dealer', hole: true });
  let i = 0;
  const dealNext = () => {
    if (i >= steps.length) { afterDeal(room, bettors); return; }
    const step = steps[i++]; const card = draw(room);
    if (step.to === 'dealer') room.dealer.cards.push(card);
    else { const p = room.players.get(step.to); if (p) p.hands[0].cards.push(card); }
    fx(room, { type: 'deal', to: step.to, hole: !!step.hole });
    broadcast(room);
    room.timer = setTimeout(dealNext, 420);
  };
  dealNext();
}

function settleSideBets(room, bettors) {
  const up = room.dealer.cards[0];
  for (const p of bettors) {
    const hand = p.hands[0]; const c1 = hand.cards[0], c2 = hand.cards[1];
    let delta = 0; const results = [];
    if (p.sideBets.perfectPairs > 0) {
      const r = evalPerfectPairs(c1, c2);
      if (r.win) { const w = p.sideBets.perfectPairs * r.mult; p.chips += w + p.sideBets.perfectPairs; delta += w; results.push({ name: 'Perfect Pairs', win: true, label: r.label, amount: w }); }
      else { delta -= p.sideBets.perfectPairs; results.push({ name: 'Perfect Pairs', win: false, amount: -p.sideBets.perfectPairs }); }
    }
    if (p.sideBets.twentyOnePlus3 > 0) {
      const r = evalTwentyOnePlus3(c1, c2, up);
      if (r.win) { const w = p.sideBets.twentyOnePlus3 * r.mult; p.chips += w + p.sideBets.twentyOnePlus3; delta += w; results.push({ name: '21+3', win: true, label: r.label, amount: w }); }
      else { delta -= p.sideBets.twentyOnePlus3; results.push({ name: '21+3', win: false, amount: -p.sideBets.twentyOnePlus3 }); }
    }
    if (results.length) fxTo(p.socketId, { type: 'sideBetResult', results, delta });
  }
}

function afterDeal(room, bettors) {
  clearTimer(room); room.dealer.hideHole = true;
  settleSideBets(room, bettors);
  const up = room.dealer.cards[0];
  for (const p of bettors) if (isBlackjack(p.hands[0].cards)) p.hands[0].blackjack = true;
  if (room.settings.allowInsurance && up.rank === 'A') {
    room.phase = 'insurance'; broadcast(room); fx(room, { type: 'insuranceOffer' });
    setPhaseTimer(room, 12, () => proceedAfterInsurance(room, bettors)); return;
  }
  proceedAfterInsurance(room, bettors);
}

function proceedAfterInsurance(room, bettors) {
  clearTimer(room);
  const dealerHasBJ = isBlackjack(room.dealer.cards);
  for (const p of bettors) {
    if (p.insuranceBet > 0 && !p.insuranceResolved) {
      p.insuranceResolved = true;
      if (dealerHasBJ) { const w = p.insuranceBet * 2; p.chips += w + p.insuranceBet; p.lastDelta += w; fxTo(p.socketId, { type: 'insuranceWin', amount: w }); }
      else { p.lastDelta -= p.insuranceBet; fxTo(p.socketId, { type: 'insuranceLose', amount: p.insuranceBet }); }
    }
  }
  if (dealerHasBJ) { room.dealer.hideHole = false; fx(room, { type: 'dealerBlackjack' }); settleRound(room, bettors); return; }
  if (!bettors.some(p => !p.hands[0].blackjack)) { room.dealer.hideHole = false; settleRound(room, bettors); return; }
  room.turnOrder = [];
  for (const p of bettors) { if (p.hands[0].blackjack) { p.hands[0].done = true; continue; } room.turnOrder.push({ playerId: p.id, handIndex: 0 }); }
  room.turnPointer = 0; room.phase = 'playerTurns'; advanceToCurrentTurn(room);
}

const currentTurn = room => room.turnOrder[room.turnPointer] || null;
function advanceToCurrentTurn(room) {
  const t = currentTurn(room);
  if (!t) { startDealerTurn(room); return; }
  const p = room.players.get(t.playerId);
  if (!p || !p.connected) { room.turnPointer++; advanceToCurrentTurn(room); return; }
  room.activePlayerId = t.playerId; room.activeHandIndex = t.handIndex; p.activeHand = t.handIndex;
  const hand = p.hands[t.handIndex];
  if (handValue(hand.cards).total >= 21 || hand.done) { hand.done = true; nextTurn(room); return; }
  broadcast(room); fx(room, { type: 'turn', playerId: p.id, handIndex: t.handIndex });
  setPhaseTimer(room, room.settings.turnTimer, () => autoStand(room, p.id, t.handIndex));
}
function autoStand(room, playerId, handIndex) {
  const t = currentTurn(room); if (!t || t.playerId !== playerId || t.handIndex !== handIndex) return;
  const p = room.players.get(playerId); if (p) { p.hands[handIndex].done = true; fx(room, { type: 'autoStand', playerId }); }
  nextTurn(room);
}
function nextTurn(room) { clearTimer(room); room.turnPointer++; advanceToCurrentTurn(room); }
function refreshTurnTimer(room, p, hi) { setPhaseTimer(room, room.settings.turnTimer, () => autoStand(room, p.id, hi)); }
function reindexTurnOrder(room, p) { let i = 0; for (const e of room.turnOrder) if (e.playerId === p.id) { e.handIndex = i++; } }

function startDealerTurn(room) {
  clearTimer(room); room.activePlayerId = null; room.phase = 'dealerTurn'; room.dealer.hideHole = false;
  broadcast(room); fx(room, { type: 'revealHole' });
  const bettors = eligiblePlayers(room).filter(p => p.hands.length > 0);
  const anyLive = bettors.some(p => p.hands.some(h => !h.surrendered && handValue(h.cards).total <= 21 && !h.blackjack));
  const step = () => {
    const hv = handValue(room.dealer.cards);
    const mustHit = hv.total < 17 || (hv.total === 17 && hv.soft && room.settings.dealerHitsSoft17);
    if (anyLive && mustHit) { room.dealer.cards.push(draw(room)); fx(room, { type: 'dealerHit' }); broadcast(room); room.timer = setTimeout(step, 640); }
    else settleRound(room, bettors);
  };
  room.timer = setTimeout(step, 700);
}

function settleRound(room, bettors) {
  clearTimer(room); room.phase = 'payout'; room.dealer.hideHole = false;
  const dv = handValue(room.dealer.cards); const dealerBust = dv.total > 21; const dealerBJ = isBlackjack(room.dealer.cards);
  const summary = [];
  for (const p of bettors) {
    let roundDelta = p.lastDelta;
    for (const hand of p.hands) {
      const bet = hand.bet; let result, payout = 0;
      if (hand.surrendered) { result = 'surrender'; payout = bet / 2; roundDelta -= bet / 2; }
      else {
        const hvt = handValue(hand.cards).total;
        if (hvt > 21) { result = 'bust'; roundDelta -= bet; }
        else if (hand.blackjack && !dealerBJ) { result = 'blackjack'; const win = Math.round(bet * room.settings.blackjackPayout); payout = bet + win; roundDelta += win; }
        else if (dealerBJ && !hand.blackjack) { result = 'lose'; roundDelta -= bet; }
        else if (hand.blackjack && dealerBJ) { result = 'push'; payout = bet; }
        else if (dealerBust || hvt > dv.total) { result = 'win'; payout = bet * 2; roundDelta += bet; }
        else if (hvt < dv.total) { result = 'lose'; roundDelta -= bet; }
        else { result = 'push'; payout = bet; }
      }
      hand.result = result; p.chips += payout;
    }
    const net = roundDelta; p.lastDelta = net;
    const won = p.hands.some(h => h.result === 'win' || h.result === 'blackjack');
    const lost = p.hands.every(h => ['lose', 'bust', 'surrender'].includes(h.result));
    const acc = accounts[p.account.toLowerCase()];
    if (p.hands.some(h => h.result === 'blackjack')) { p.stats.blackjacks++; if (acc) acc.stats.blackjacks++; }
    if (won) { p.stats.wins++; p.stats.streak = p.stats.streak >= 0 ? p.stats.streak + 1 : 1; if (acc) acc.stats.handsWon++; }
    else if (lost) { p.stats.losses++; p.stats.streak = p.stats.streak <= 0 ? p.stats.streak - 1 : -1; if (acc) acc.stats.handsLost++; }
    else { p.stats.pushes++; if (acc) acc.stats.pushes++; }
    if (Math.abs(p.stats.streak) > Math.abs(p.stats.bestStreak)) p.stats.bestStreak = p.stats.streak;
    if (acc && Math.abs(p.stats.streak) > Math.abs(acc.stats.bestStreak)) acc.stats.bestStreak = p.stats.streak;
    p.stats.netRound = net;
    summary.push({ playerId: p.id, name: p.name, net, chips: p.chips, results: p.hands.map(h => h.result) });
  }
  persist();
  broadcast(room); fx(room, { type: 'payout', dealerBust, dealerBJ, dealerValue: dv.total, summary });

  // tournament elimination
  if (room.settings.mode === 'tournament' && room.matchActive) {
    setPhaseTimer(room, 5, () => { handleElimination(room); });
  } else {
    setPhaseTimer(room, 5, () => startBetting(room));
  }
}

function handleElimination(room) {
  let anyEliminated = false;
  for (const p of eligiblePlayers(room)) {
    if (p.chips <= 0) { p.eliminated = true; p.chips = 0; anyEliminated = true; fx(room, { type: 'eliminated', name: p.name, playerId: p.id }); }
  }
  const remaining = eligiblePlayers(room);
  // End only when an elimination actually thinned the field to a single survivor (or none).
  if (anyEliminated && remaining.length <= 1) { endMatch(room, remaining[0] || null); return; }
  startBetting(room);
}

function endMatch(room, winnerPlayer) {
  clearTimer(room);
  room.matchActive = false; room.phase = 'matchOver';
  let winnerName = null;
  if (winnerPlayer) {
    winnerName = winnerPlayer.name;
    const acc = accounts[winnerPlayer.account.toLowerCase()];
    if (acc) { acc.money += room.prizePool; acc.stats.matchesWon++; if (room.prizePool > acc.stats.biggestPot) acc.stats.biggestPot = room.prizePool; }
  }
  room.winner = { name: winnerName, pool: room.prizePool };
  // count matchesPlayed for all who anted
  for (const p of room.players.values()) { if (p.anted) { const a = accounts[p.account.toLowerCase()]; if (a) a.stats.matchesPlayed++; } }
  persist();
  fx(room, { type: 'matchOver', winner: winnerName, pool: room.prizePool });
  broadcast(room);
  // reset to lobby for a rematch after a pause
  setPhaseTimer(room, 9, () => {
    room.prizePool = 0;
    for (const p of room.players.values()) { p.eliminated = false; p.spectator = false; p.anted = false; p.chips = 0; p.hands = []; }
    room.phase = 'lobby'; room.winner = null; broadcast(room);
  });
}

/* =============================== HELPERS ============================== */
function getRoomBySocket(s) { const c = s.data.roomCode; return c ? rooms.get(c) : null; }
function getPlayer(room, s) { return room ? room.players.get(s.data.playerId) : null; }
function pickSeat(room) { const taken = new Set(seatedPlayersInOrder(room).map(p => p.seat)); for (let i = 0; i < room.settings.maxPlayers; i++) if (!taken.has(i)) return i; return -1; }
function anteUp(room, player) {
  const acc = accounts[player.account.toLowerCase()];
  const cost = room.settings.buyIn;
  if (!acc || acc.money < cost) return false;
  acc.money -= cost; room.prizePool += cost;
  player.chips = room.settings.startingChips; player.anted = true; player.eliminated = false; player.spectator = false;
  persist();
  return true;
}

/* =============================== SOCKETS ============================== */
io.on('connection', (socket) => {
  socket.emit('account', publicAccount(sockAccount(socket)));

  socket.on('createRoom', (data, cb) => {
    try {
      const acc = sockAccount(socket); if (!acc) return cb && cb({ ok: false, error: 'auth' });
      const room = createRoom(data && data.settings);
      const player = newPlayer(socket); player.seat = pickSeat(room);
      room.players.set(player.id, player); room.seatOrder.push(player.id); room.hostId = player.id;
      socket.data.roomCode = room.code; socket.data.playerId = player.id; socket.join(room.code);

      if (room.settings.mode === 'tournament') {
        if (!anteUp(room, player)) { rooms.delete(room.code); return cb && cb({ ok: false, error: 'broke', message: 'Nicht genug Geld für Buy-in' }); }
        room.phase = 'lobby'; broadcast(room);
        cb && cb({ ok: true, roomCode: room.code, playerId: player.id });
      } else {
        player.chips = room.settings.startingChips;
        cb && cb({ ok: true, roomCode: room.code, playerId: player.id });
        startBetting(room);
      }
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'create_failed' }); }
  });

  socket.on('joinRoom', (data, cb) => {
    try {
      const acc = sockAccount(socket); if (!acc) return cb && cb({ ok: false, error: 'auth' });
      const code = (data && data.roomCode || '').toString().toUpperCase().trim();
      const room = rooms.get(code); if (!room) return cb && cb({ ok: false, error: 'no_room' });
      if (seatedPlayersInOrder(room).length >= room.settings.maxPlayers) return cb && cb({ ok: false, error: 'full' });
      // prevent same account twice
      for (const p of room.players.values()) if (p.account.toLowerCase() === acc.username.toLowerCase()) return cb && cb({ ok: false, error: 'already_in', message: 'Schon im Raum' });

      const player = newPlayer(socket); player.seat = pickSeat(room);
      if (player.seat < 0) return cb && cb({ ok: false, error: 'full' });
      room.players.set(player.id, player); room.seatOrder.push(player.id);
      room.seatOrder.sort((a, b) => room.players.get(a).seat - room.players.get(b).seat);
      socket.data.roomCode = code; socket.data.playerId = player.id; socket.join(code);

      if (room.settings.mode === 'tournament') {
        if (room.matchActive) { player.spectator = true; }       // late join -> spectate this match
        else if (!anteUp(room, player)) { // can't afford -> spectate
          player.spectator = true;
          cb && cb({ ok: true, roomCode: code, playerId: player.id, spectator: true, message: 'Zu wenig Geld – du schaust zu' });
          fx(room, { type: 'playerJoined', name: player.name }); broadcast(room); return;
        }
      } else { player.chips = room.settings.startingChips; }

      cb && cb({ ok: true, roomCode: code, playerId: player.id, spectator: player.spectator });
      fx(room, { type: 'playerJoined', name: player.name }); broadcast(room);
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'join_failed' }); }
  });

  socket.on('startMatch', () => {
    const room = getRoomBySocket(socket); if (!room || room.hostId !== socket.data.playerId) return;
    if (room.settings.mode !== 'tournament' || room.matchActive) return;
    const anted = eligiblePlayers(room).filter(p => p.anted);
    if (anted.length < 1) return;
    room.matchActive = true; room.winner = null;
    fx(room, { type: 'matchStart' }); startBetting(room);
  });

  socket.on('updateSettings', (data) => {
    const room = getRoomBySocket(socket); if (!room || room.hostId !== socket.data.playerId) return;
    if (room.matchActive) return; // can't change mid-tournament
    if (!['betting', 'lobby'].includes(room.phase)) return;
    room.settings = sanitizeSettings({ ...room.settings, ...(data || {}) });
    broadcast(room); fx(room, { type: 'settingsUpdated' });
  });

  socket.on('placeBet', (data) => {
    const room = getRoomBySocket(socket); const p = getPlayer(room, socket);
    if (!room || !p || room.phase !== 'betting' || p.eliminated || p.spectator) return;
    let main = clamp(int(data && data.amount, 0), 0, p.chips);
    let pp = 0, t3 = 0;
    if (room.settings.sideBetsEnabled) {
      if (room.settings.allowPerfectPairs) pp = clamp(int(data && data.perfectPairs, 0), 0, p.chips);
      if (room.settings.allow21p3) t3 = clamp(int(data && data.twentyOnePlus3, 0), 0, p.chips);
    }
    if (main > 0) {
      const lo = Math.min(room.settings.minBet, p.chips); // all-in allowed below min
      main = clamp(main, lo, room.settings.maxBet);
    }
    const total = main + pp + t3; if (total <= 0 || total > p.chips) return;
    p.chips += p.bet + p.sideBets.perfectPairs + p.sideBets.twentyOnePlus3;
    p.bet = main; p.sideBets = { perfectPairs: pp, twentyOnePlus3: t3 }; p.chips -= total; p.hasBet = main > 0;
    broadcast(room); fxTo(socket.id, { type: 'betPlaced' });
  });

  socket.on('clearBet', () => {
    const room = getRoomBySocket(socket); const p = getPlayer(room, socket);
    if (!room || !p || room.phase !== 'betting') return;
    p.chips += p.bet + p.sideBets.perfectPairs + p.sideBets.twentyOnePlus3;
    p.bet = 0; p.sideBets = { perfectPairs: 0, twentyOnePlus3: 0 }; p.hasBet = false; broadcast(room);
  });

  socket.on('deal', () => {
    const room = getRoomBySocket(socket); if (!room || room.hostId !== socket.data.playerId) return;
    if (room.phase !== 'betting') return; beginDeal(room);
  });

  socket.on('insurance', (data) => {
    const room = getRoomBySocket(socket); const p = getPlayer(room, socket);
    if (!room || !p || room.phase !== 'insurance' || p.insuranceResolved || p.insuranceAnswered || p.hands.length === 0) return;
    p.insuranceAnswered = true;
    if (data && data.take) {
      const cost = Math.floor(p.hands[0].bet / 2);
      if (cost > 0 && p.chips >= cost) { p.chips -= cost; p.insuranceBet = cost; fxTo(socket.id, { type: 'insuranceTaken', amount: cost }); }
    }
    broadcast(room);
    // advance immediately once every player with a bet has answered (timer is the fallback)
    const bettors = eligiblePlayers(room).filter(x => x.hands.length > 0);
    if (bettors.every(x => x.insuranceAnswered)) { clearTimer(room); proceedAfterInsurance(room, bettors); }
  });

  socket.on('action', (data) => {
    const room = getRoomBySocket(socket); const p = getPlayer(room, socket);
    if (!room || !p || room.phase !== 'playerTurns') return;
    const t = currentTurn(room); if (!t || t.playerId !== p.id) return;
    const hand = p.hands[t.handIndex]; if (!hand || hand.done) return;
    const type = data && data.type;
    if (type === 'hit') {
      hand.cards.push(draw(room)); fx(room, { type: 'hit', playerId: p.id, handIndex: t.handIndex });
      if (handValue(hand.cards).total >= 21) { hand.done = true; broadcast(room); nextTurn(room); }
      else { broadcast(room); refreshTurnTimer(room, p, t.handIndex); }
    } else if (type === 'stand') { hand.done = true; fx(room, { type: 'stand', playerId: p.id }); broadcast(room); nextTurn(room); }
    else if (type === 'double') {
      const canDouble = hand.cards.length === 2 && (!hand.isSplit || room.settings.doubleAfterSplit);
      if (!canDouble || p.chips < hand.bet) return;
      p.chips -= hand.bet; hand.bet *= 2; hand.doubled = true; hand.cards.push(draw(room)); hand.done = true;
      fx(room, { type: 'double', playerId: p.id, handIndex: t.handIndex }); broadcast(room); nextTurn(room);
    } else if (type === 'split') {
      const canSplit = hand.cards.length === 2 && hand.cards[0].value === hand.cards[1].value && p.hands.length < 4 && p.chips >= hand.bet;
      if (!canSplit) return;
      p.chips -= hand.bet; const moved = hand.cards.pop(); const isAce = hand.cards[0].rank === 'A';
      const nh = { cards: [moved], bet: hand.bet, done: false, result: null, isSplit: true, doubled: false, surrendered: false, blackjack: false };
      hand.isSplit = true; hand.cards.push(draw(room)); nh.cards.push(draw(room));
      p.hands.splice(t.handIndex + 1, 0, nh);
      room.turnOrder.splice(room.turnPointer + 1, 0, { playerId: p.id, handIndex: t.handIndex + 1 });
      reindexTurnOrder(room, p);
      if (isAce) { hand.done = true; nh.done = true; }
      fx(room, { type: 'split', playerId: p.id }); broadcast(room);
      if (hand.done) nextTurn(room); else refreshTurnTimer(room, p, t.handIndex);
    } else if (type === 'surrender') {
      if (!room.settings.surrenderAllowed || hand.cards.length !== 2 || hand.isSplit) return;
      hand.surrendered = true; hand.done = true; fx(room, { type: 'surrender', playerId: p.id }); broadcast(room); nextTurn(room);
    }
  });

  socket.on('rebuy', () => {
    const room = getRoomBySocket(socket); const p = getPlayer(room, socket);
    if (!room || !p) return;
    if (room.settings.mode === 'tournament') return; // no rebuy in tournaments
    if (p.chips <= 0 && p.bet === 0) { p.chips = room.settings.startingChips; fxTo(socket.id, { type: 'rebuy', amount: p.chips }); broadcast(room); }
  });

  socket.on('forfeit', () => {
    // tournament: give up & leave the match
    const room = getRoomBySocket(socket); const p = getPlayer(room, socket);
    if (!room || !p) return;
    if (room.settings.mode === 'tournament' && room.matchActive && !p.eliminated && !p.spectator) {
      p.eliminated = true; p.chips = 0;
      fx(room, { type: 'forfeit', name: p.name });
      const t = currentTurn(room);
      if (room.phase === 'playerTurns' && t && t.playerId === p.id) { for (const h of p.hands) h.done = true; clearTimer(room); nextTurn(room); }
      const remaining = eligiblePlayers(room);
      if (remaining.length <= 1 && room.phase !== 'payout') endMatch(room, remaining[0] || null);
      else broadcast(room);
    }
  });

  socket.on('emote', (data) => {
    const room = getRoomBySocket(socket); const p = getPlayer(room, socket); if (!room || !p) return;
    const emoji = (data && data.emoji || '').toString().slice(0, 16);
    p.emote = emoji; p.emoteAt = Date.now(); fx(room, { type: 'emote', playerId: p.id, emoji }); broadcast(room);
  });

  socket.on('chat', (data) => {
    const room = getRoomBySocket(socket); const p = getPlayer(room, socket); if (!room || !p) return;
    const msg = (data && data.msg || '').toString().slice(0, 140); if (!msg.trim()) return;
    io.to(room.code).emit('chat', { name: p.name, msg, playerId: p.id, ts: Date.now() });
  });

  socket.on('leaveRoom', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket, true));
});

function handleLeave(socket) {
  const room = getRoomBySocket(socket); if (!room) return;
  const p = room.players.get(socket.data.playerId); if (!p) return;
  p.connected = false;
  const t = currentTurn(room);
  if (room.phase === 'playerTurns' && t && t.playerId === p.id) { for (const h of p.hands) h.done = true; clearTimer(room); nextTurn(room); }
  room.players.delete(p.id); room.seatOrder = room.seatOrder.filter(id => id !== p.id);
  if (room.hostId === p.id) room.hostId = room.seatOrder[0] || null;
  socket.leave(room.code); socket.data.roomCode = null;
  if (room.players.size === 0) { clearTimer(room); rooms.delete(room.code); return; }
  // tournament: leaving counts like forfeit
  if (room.settings.mode === 'tournament' && room.matchActive) {
    const remaining = eligiblePlayers(room);
    if (remaining.length <= 1 && room.phase !== 'payout') { endMatch(room, remaining[0] || null); return; }
  }
  fx(room, { type: 'playerLeft', name: p.name }); broadcast(room);
}

setInterval(() => { for (const [code, room] of rooms) if (room.players.size === 0) { clearTimer(room); rooms.delete(code); } }, 60000);

server.listen(PORT, () => console.log(`NOVA CASINO listening on :${PORT}`));
