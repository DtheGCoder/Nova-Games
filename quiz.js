/* =========================================================================
   NOVA QUIZ — multiplayer trivia with confidence wagering.
   Self-contained module; attaches 'quiz:*' socket handlers. Shares accounts
   & money with the main server via injected deps. Does not touch blackjack.
   ========================================================================= */
'use strict';
const { CATEGORIES, QUESTIONS } = require('./questions');
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const DIFF_LABEL = { 1: 'Leicht', 2: 'Mittel', 3: 'Schwer' };

const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const DEFAULTS = {
  mode: 'cash', buyIn: 1000, startingChips: 1000,
  category: 'mixed', difficulty: 'mixed',
  totalRounds: 10, questionTime: 18, wagerTime: 8,
  minBet: 50, maxBet: 500, maxPlayers: 8, powerups: true,
};
function sanitize(s) {
  const o = { ...DEFAULTS, ...(s || {}) };
  o.mode = o.mode === 'tournament' ? 'tournament' : 'cash';
  o.buyIn = clamp(int(o.buyIn, 1000), 100, 1000000);
  o.startingChips = clamp(int(o.startingChips, 1000), 100, 1000000);
  o.category = (o.category === 'mixed' || CAT_BY_ID[o.category]) ? o.category : 'mixed';
  o.difficulty = ['mixed', 'easy', 'medium', 'hard'].includes(o.difficulty) ? o.difficulty : 'mixed';
  o.totalRounds = clamp(int(o.totalRounds, 10), 3, 30);
  o.questionTime = clamp(int(o.questionTime, 18), 8, 40);
  o.wagerTime = clamp(int(o.wagerTime, 8), 4, 20);
  o.minBet = clamp(int(o.minBet, 50), 1, 100000);
  o.maxBet = clamp(int(o.maxBet, 500), o.minBet, 1000000);
  o.maxPlayers = clamp(int(o.maxPlayers, 8), 1, 10);
  o.powerups = !!o.powerups;
  if (o.mode === 'tournament') o.startingChips = o.buyIn;
  return o;
}

module.exports = function createQuiz(deps) {
  const { io, getAccount, persist, publicAccount, pushAccountUpdate } = deps;
  const rooms = new Map();

  /* ----------------------------- helpers ----------------------------- */
  function makeCode() {
    const ab = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c;
    do { c = 'Q'; for (let i = 0; i < 3; i++) c += ab[Math.floor(Math.random() * ab.length)]; } while (rooms.has(c));
    return c;
  }
  function buildDeck(s) {
    let pool = QUESTIONS;
    if (s.category !== 'mixed') pool = pool.filter(q => q.c === s.category);
    const dmap = { easy: 1, medium: 2, hard: 3 };
    if (s.difficulty !== 'mixed') pool = pool.filter(q => q.d === dmap[s.difficulty]);
    if (pool.length < 3) pool = QUESTIONS; // safety fallback
    return shuffle(pool);
  }
  function seated(room) { return room.seatOrder.map(id => room.players.get(id)).filter(Boolean); }
  function eligible(room) { return seated(room).filter(p => !p.eliminated && !p.spectator); }
  function pickSeat(room) { const t = new Set(seated(room).map(p => p.seat)); for (let i = 0; i < room.settings.maxPlayers; i++) if (!t.has(i)) return i; return -1; }

  function createRoom(settings) {
    const code = makeCode();
    const room = {
      code, hostId: null, settings: sanitize(settings),
      players: new Map(), seatOrder: [],
      phase: 'lobby', matchActive: false, prizePool: 0, winner: null,
      deck: [], round: 0, currentQ: null, qStartAt: 0,
      timer: null, timerEndsAt: 0,
    };
    rooms.set(code, room);
    return room;
  }
  function newPlayer(socket) {
    const acc = getAccount(socket.data.username);
    return {
      id: socket.id, socketId: socket.id, account: acc.username, name: acc.username,
      seat: -1, connected: true, chips: 0,
      wager: 0, answer: -1, answerAt: 0, locked: false, correct: null,
      roundDelta: 0, streak: 0, bestStreak: 0, correctCount: 0,
      eliminated: false, spectator: false, anted: false,
      powerups: { fifty: 2, double: 1 }, doubleActive: false,
      emote: null, emoteAt: 0,
    };
  }
  function anteUp(room, p) {
    const acc = getAccount(p.account); const cost = room.settings.buyIn;
    if (!acc || acc.money < cost) return false;
    acc.money -= cost; room.prizePool += cost; p.chips = room.settings.startingChips;
    p.anted = true; p.eliminated = false; p.spectator = false; persist(); pushAccountUpdate(acc);
    return true;
  }

  /* ----------------------------- timers ----------------------------- */
  function clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } room.timerEndsAt = 0; }
  function setTimer(room, sec, cb) { clearTimer(room); room.timerEndsAt = Date.now() + sec * 1000; room.timer = setTimeout(() => { room.timer = null; room.timerEndsAt = 0; cb(); }, sec * 1000); }

  /* ----------------------------- state ----------------------------- */
  function publicState(room) {
    const showQ = room.phase === 'question' || room.phase === 'reveal';
    const reveal = room.phase === 'reveal';
    let question = null;
    if (room.currentQ) {
      const cat = CAT_BY_ID[room.currentQ.c] || { name: room.currentQ.c, color: '#ffd76a', icon: 'star' };
      question = {
        category: cat.name, categoryId: room.currentQ.c, color: cat.color, icon: cat.icon,
        difficulty: room.currentQ.d, difficultyLabel: DIFF_LABEL[room.currentQ.d],
        q: showQ ? room.currentQ.q : null,
        options: showQ ? room.currentQ.a : null,
        answer: reveal ? room.currentQ.k : null,
      };
    }
    const players = seated(room).map(p => ({
      id: p.id, name: p.name, chips: p.chips, seat: p.seat, connected: p.connected,
      wager: p.wager, locked: p.locked,
      answer: reveal ? p.answer : null,
      correct: reveal ? p.correct : null,
      roundDelta: reveal ? p.roundDelta : 0,
      streak: p.streak, correctCount: p.correctCount,
      eliminated: p.eliminated, spectator: p.spectator, anted: p.anted,
      doubleActive: p.doubleActive, powerups: p.powerups,
      emote: (p.emote && Date.now() - p.emoteAt < 3500) ? p.emote : null,
      isHost: room.hostId === p.id,
    }));
    return {
      code: room.code, phase: room.phase, mode: room.settings.mode, settings: room.settings,
      hostId: room.hostId, matchActive: room.matchActive, prizePool: room.prizePool,
      round: room.round, totalRounds: room.settings.totalRounds, winner: room.winner,
      question, players, timerEndsAt: room.timerEndsAt, serverNow: Date.now(),
    };
  }
  const broadcast = room => io.to('quiz:' + room.code).emit('quiz:state', publicState(room));
  const fx = (room, p) => io.to('quiz:' + room.code).emit('quiz:fx', p);
  const fxTo = (sid, p) => io.to(sid).emit('quiz:fx', p);

  /* ----------------------------- flow ----------------------------- */
  function startMatch(room) {
    room.deck = buildDeck(room.settings);
    // ensure every active player has a stake (handles fresh start AND rematch)
    for (const p of eligible(room)) {
      if (room.settings.mode === 'cash') { p.chips = room.settings.startingChips; }
      else if (!p.anted) { if (!anteUp(room, p)) { p.spectator = true; } }
    }
    room.matchActive = true; room.round = 0; room.winner = null;
    for (const p of room.players.values()) { p.streak = 0; p.correctCount = 0; p.bestStreak = 0; p.powerups = { fifty: 2, double: 1 }; }
    fx(room, { type: 'matchStart' });
    nextQuestion(room);
  }

  function nextQuestion(room) {
    clearTimer(room);
    const live = eligible(room);
    if (room.round >= room.settings.totalRounds || live.length === 0 || (room.matchActive && room.settings.mode === 'tournament' && live.length <= 1 && room.round > 0)) {
      return gameOver(room);
    }
    room.round += 1;
    room.currentQ = room.deck[(room.round - 1) % room.deck.length];
    room.phase = 'wager';
    for (const p of room.players.values()) {
      p.answer = -1; p.locked = false; p.correct = null; p.roundDelta = 0; p.doubleActive = false; p.answerAt = 0;
      if (!p.eliminated && !p.spectator) p.wager = clamp(Math.min(room.settings.minBet, p.chips), 1, p.chips); else p.wager = 0;
    }
    broadcast(room);
    fx(room, { type: 'wagerOpen', round: room.round });
    setTimer(room, room.settings.wagerTime, () => startQuestion(room));
  }

  function startQuestion(room) {
    clearTimer(room);
    room.phase = 'question'; room.qStartAt = Date.now();
    // ensure everyone has a valid wager
    for (const p of eligible(room)) p.wager = clamp(p.wager || Math.min(room.settings.minBet, p.chips), 1, p.chips);
    broadcast(room);
    fx(room, { type: 'questionStart' });
    setTimer(room, room.settings.questionTime, () => revealAnswer(room));
  }

  function maybeEarlyReveal(room) {
    if (room.phase !== 'question') return;
    const live = eligible(room);
    if (live.length > 0 && live.every(p => p.locked)) { clearTimer(room); setTimeout(() => revealAnswer(room), 400); }
  }

  function revealAnswer(room) {
    clearTimer(room);
    room.phase = 'reveal';
    const correctIdx = room.currentQ.k;
    const qTime = room.settings.questionTime * 1000;
    for (const p of eligible(room)) {
      const answered = p.locked && p.answer >= 0;
      const isCorrect = answered && p.answer === correctIdx;
      p.correct = isCorrect;
      const dm = p.doubleActive ? 2 : 1;
      if (isCorrect) {
        const elapsed = Math.max(0, (p.answerAt || Date.now()) - room.qStartAt);
        const speedFrac = clamp(1 - elapsed / qTime, 0, 1);           // 1 = instant, 0 = last second
        const streakMult = 1 + Math.min(p.streak, 5) * 0.1;          // up to +50%
        const profit = Math.max(1, Math.round(p.wager * (1 + speedFrac) * streakMult * dm));
        p.chips += profit; p.roundDelta = profit;
        p.streak += 1; if (p.streak > p.bestStreak) p.bestStreak = p.streak; p.correctCount += 1;
      } else {
        const loss = Math.round(p.wager * dm);
        p.chips = Math.max(0, p.chips - loss); p.roundDelta = -loss; p.streak = 0;
      }
    }
    persist();
    broadcast(room);
    fx(room, { type: 'reveal', answer: correctIdx });
    setTimer(room, 5, () => afterReveal(room));
  }

  function afterReveal(room) {
    clearTimer(room);
    if (room.settings.mode === 'tournament' && room.matchActive) {
      for (const p of eligible(room)) if (p.chips <= 0) { p.eliminated = true; p.chips = 0; fx(room, { type: 'eliminated', name: p.name, playerId: p.id }); }
    }
    nextQuestion(room);
  }

  function gameOver(room) {
    clearTimer(room);
    room.matchActive = false; room.phase = 'gameover';
    const ranking = seated(room).filter(p => p.anted || room.settings.mode === 'cash')
      .sort((a, b) => b.chips - a.chips);
    const top = ranking[0] || null;
    let winnerName = null;
    if (room.settings.mode === 'tournament' && top) {
      winnerName = top.name;
      const acc = getAccount(top.account);
      if (acc) { acc.money += room.prizePool; acc.stats.matchesWon = (acc.stats.matchesWon || 0) + 1; if (room.prizePool > (acc.stats.biggestPot || 0)) acc.stats.biggestPot = room.prizePool; pushAccountUpdate(acc); }
      for (const p of room.players.values()) { if (p.anted) { const a = getAccount(p.account); if (a) a.stats.matchesPlayed = (a.stats.matchesPlayed || 0) + 1; } }
    } else if (top) { winnerName = top.name; }
    persist();
    room.winner = { name: winnerName, pool: room.prizePool, ranking: ranking.map(p => ({ name: p.name, chips: p.chips, correct: p.correctCount, best: p.bestStreak })) };
    broadcast(room);
    fx(room, { type: 'gameOver', winner: winnerName, pool: room.prizePool });
    setTimer(room, 12, () => {
      room.prizePool = 0; room.phase = 'lobby'; room.winner = null; room.round = 0; room.currentQ = null;
      for (const p of room.players.values()) { p.eliminated = false; p.spectator = false; p.anted = false; p.streak = 0; p.correctCount = 0; p.chips = room.settings.mode === 'cash' ? room.settings.startingChips : 0; }
      broadcast(room);
    });
  }

  /* ----------------------------- leave ----------------------------- */
  function handleLeave(socket) {
    const code = socket.data.quizCode; if (!code) return;
    const room = rooms.get(code); if (!room) return;
    const p = room.players.get(socket.id); if (!p) return;
    room.players.delete(p.id); room.seatOrder = room.seatOrder.filter(id => id !== p.id);
    if (room.hostId === p.id) room.hostId = room.seatOrder[0] || null;
    socket.leave('quiz:' + code); socket.data.quizCode = null;
    if (room.players.size === 0) { clearTimer(room); rooms.delete(code); return; }
    if (room.matchActive && room.settings.mode === 'tournament') {
      const live = eligible(room);
      if (live.length <= 1 && room.phase !== 'gameover') return gameOver(room);
    }
    fx(room, { type: 'playerLeft', name: p.name }); broadcast(room);
  }

  /* ----------------------------- attach ----------------------------- */
  function attach(socket) {
    socket.on('quiz:create', (data, cb) => {
      try {
        const acc = getAccount(socket.data.username); if (!acc) return cb && cb({ ok: false, error: 'auth' });
        if (socket.data.quizCode) handleLeave(socket);
        const room = createRoom(data && data.settings);
        const p = newPlayer(socket); p.seat = pickSeat(room);
        room.players.set(p.id, p); room.seatOrder.push(p.id); room.hostId = p.id;
        socket.data.quizCode = room.code; socket.join('quiz:' + room.code);
        if (room.settings.mode === 'tournament') {
          if (!anteUp(room, p)) { rooms.delete(room.code); return cb && cb({ ok: false, error: 'broke', message: 'Nicht genug Geld für Buy-in' }); }
        } else p.chips = room.settings.startingChips;
        cb && cb({ ok: true, code: room.code, playerId: p.id });
        broadcast(room);
      } catch (e) { console.error('quiz:create', e); cb && cb({ ok: false, error: 'failed' }); }
    });

    socket.on('quiz:join', (data, cb) => {
      try {
        const acc = getAccount(socket.data.username); if (!acc) return cb && cb({ ok: false, error: 'auth' });
        const code = (data && data.code || '').toString().toUpperCase().trim();
        const room = rooms.get(code); if (!room) return cb && cb({ ok: false, error: 'no_room' });
        if (seated(room).length >= room.settings.maxPlayers) return cb && cb({ ok: false, error: 'full' });
        for (const pp of room.players.values()) if (pp.account.toLowerCase() === acc.username.toLowerCase()) return cb && cb({ ok: false, error: 'already_in' });
        if (socket.data.quizCode) handleLeave(socket);
        const p = newPlayer(socket); p.seat = pickSeat(room);
        if (p.seat < 0) return cb && cb({ ok: false, error: 'full' });
        room.players.set(p.id, p); room.seatOrder.push(p.id);
        room.seatOrder.sort((a, b) => room.players.get(a).seat - room.players.get(b).seat);
        socket.data.quizCode = code; socket.join('quiz:' + code);
        let spectator = false;
        if (room.settings.mode === 'tournament') {
          if (room.matchActive) { p.spectator = true; spectator = true; }
          else if (!anteUp(room, p)) { p.spectator = true; spectator = true; }
        } else p.chips = room.settings.startingChips;
        cb && cb({ ok: true, code, playerId: p.id, spectator });
        fx(room, { type: 'playerJoined', name: p.name }); broadcast(room);
      } catch (e) { console.error('quiz:join', e); cb && cb({ ok: false, error: 'failed' }); }
    });

    socket.on('quiz:start', () => {
      const room = rooms.get(socket.data.quizCode); if (!room || room.hostId !== socket.id || room.matchActive) return;
      if (eligible(room).length < 1) return;
      startMatch(room);
    });

    socket.on('quiz:settings', (data) => {
      const room = rooms.get(socket.data.quizCode); if (!room || room.hostId !== socket.id || room.matchActive) return;
      if (room.phase !== 'lobby') return;
      room.settings = sanitize({ ...room.settings, ...(data || {}) });
      broadcast(room); fx(room, { type: 'settingsUpdated' });
    });

    socket.on('quiz:wager', (data) => {
      const room = rooms.get(socket.data.quizCode); if (!room || room.phase !== 'wager') return;
      const p = room.players.get(socket.id); if (!p || p.eliminated || p.spectator) return;
      p.wager = clamp(int(data && data.amount, p.wager), Math.min(room.settings.minBet, p.chips), Math.min(room.settings.maxBet, p.chips));
      broadcast(room);
    });

    socket.on('quiz:answer', (data) => {
      const room = rooms.get(socket.data.quizCode); if (!room || room.phase !== 'question') return;
      const p = room.players.get(socket.id); if (!p || p.eliminated || p.spectator || p.locked) return;
      const idx = int(data && data.index, -1); if (idx < 0 || idx > 3) return;
      p.answer = idx; p.locked = true; p.answerAt = Date.now();
      fxTo(socket.id, { type: 'locked' });
      broadcast(room);
      maybeEarlyReveal(room);
    });

    socket.on('quiz:powerup', (data) => {
      const room = rooms.get(socket.data.quizCode); if (!room) return;
      const p = room.players.get(socket.id); if (!p || p.eliminated || p.spectator) return;
      if (!room.settings.powerups) return;
      const type = data && data.type;
      if (type === 'double') {
        if ((room.phase === 'wager' || room.phase === 'question') && !p.locked && !p.doubleActive && p.powerups.double > 0) {
          p.powerups.double -= 1; p.doubleActive = true; fxTo(socket.id, { type: 'doubleArmed' }); broadcast(room);
        }
      } else if (type === 'fifty') {
        if (room.phase === 'question' && !p.locked && p.powerups.fifty > 0) {
          p.powerups.fifty -= 1;
          const wrong = [0, 1, 2, 3].filter(i => i !== room.currentQ.k);
          const remove = shuffle(wrong).slice(0, 2);
          fxTo(socket.id, { type: 'fifty', remove });
          broadcast(room);
        }
      }
    });

    socket.on('quiz:emote', (data) => {
      const room = rooms.get(socket.data.quizCode); if (!room) return;
      const p = room.players.get(socket.id); if (!p) return;
      p.emote = (data && data.emoji || '').toString().slice(0, 16); p.emoteAt = Date.now();
      fx(room, { type: 'emote', playerId: p.id, emoji: p.emote }); broadcast(room);
    });

    socket.on('quiz:chat', (data) => {
      const room = rooms.get(socket.data.quizCode); if (!room) return;
      const p = room.players.get(socket.id); if (!p) return;
      const msg = (data && data.msg || '').toString().slice(0, 140); if (!msg.trim()) return;
      io.to('quiz:' + room.code).emit('quiz:chat', { name: p.name, msg, playerId: p.id, ts: Date.now() });
    });

    socket.on('quiz:leave', () => handleLeave(socket));
    socket.on('disconnect', () => handleLeave(socket));
  }

  setInterval(() => { for (const [code, room] of rooms) if (room.players.size === 0) { clearTimer(room); rooms.delete(code); } }, 60000);

  return {
    attach,
    online: () => { let n = 0; for (const r of rooms.values()) n += r.players.size; return n; },
    roomCount: () => rooms.size,
    categories: CATEGORIES,
  };
};
