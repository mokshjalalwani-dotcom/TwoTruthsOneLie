const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const {
  createRoom,
  addPlayer,
  rejoinPlayer,
  setMaxRounds,
  startGame,
  submitStatements,
  submitVote,
  advanceRound,
  resetGame,
  handleDisconnect,
  getRoom,
  _publicPlayers,
} = require('./gameLogic');

// ─── Environment ──────────────────────────────────────────────────────────────
const PORT        = process.env.PORT       || 3001;
const CLIENT_URL  = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── Server setup ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Support both WebSocket and long-polling so Render's proxy
  // doesn't block upgrades during the initial handshake.
  transports: ['websocket', 'polling'],
});

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// ─── Health check (required by Render) ───────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ─── Input validation helpers ─────────────────────────────────────────────────
const MAX_NICKNAME_LEN  = 20;
const MAX_STATEMENT_LEN = 200;
const ROOM_CODE_RE      = /^[A-Z0-9]{5}$/;
const UUID_RE           = /^[0-9a-f-]{36}$/i;

function sanitizeNickname(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, MAX_NICKNAME_LEN);
  return trimmed.length >= 1 ? trimmed : null;
}

function sanitizeRoomCode(raw) {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return ROOM_CODE_RE.test(upper) ? upper : null;
}

function sanitizePlayerId(raw) {
  if (typeof raw !== 'string') return null;
  return UUID_RE.test(raw.trim()) ? raw.trim() : null;
}

function sanitizeStatements(raw) {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const out = raw.map(s => ({
    text: typeof s.text === 'string' ? s.text.trim().slice(0, MAX_STATEMENT_LEN) : '',
    isLie: Boolean(s.isLie),
  }));
  // All texts must be non-empty
  if (out.some(s => s.text.length === 0)) return null;
  return out;
}

// ─── Socket event handlers ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[connect]    ${socket.id}`);

  // Catch any per-socket errors so one bad connection can't crash the process
  socket.on('error', (err) => {
    console.error(`[socket-err] ${socket.id}:`, err.message);
  });

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on('create-room', (payload) => {
    const nickname = sanitizeNickname(payload?.nickname);
    if (!nickname) {
      return socket.emit('error', { message: 'Nickname must be 1–20 characters.' });
    }

    const { room, playerId } = createRoom(socket.id, nickname);
    socket.join(room.code);
    socket.emit('room-created', {
      roomCode: room.code,
      playerId,
      maxRounds: room.maxRounds,
      players: _publicPlayers(room),
    });
    console.log(`[room]       ${room.code} created by "${nickname}"`);
  });

  // ── Join room ────────────────────────────────────────────────────────────
  socket.on('join-room', (payload) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const nickname = sanitizeNickname(payload?.nickname);

    if (!roomCode) return socket.emit('error', { message: 'Invalid room code.' });
    if (!nickname) return socket.emit('error', { message: 'Nickname must be 1–20 characters.' });

    const result = addPlayer(roomCode, socket.id, nickname);
    if (result.error) return socket.emit('error', { message: result.error });

    socket.join(roomCode);
    const room = getRoom(roomCode);

    socket.emit('room-joined', {
      roomCode,
      playerId: result.playerId,
      players: _publicPlayers(room),
      maxRounds: room.maxRounds,
      phase: room.phase,
    });
    socket.to(roomCode).emit('player-joined', { players: _publicPlayers(room) });

    console.log(`[join]       "${nickname}" → ${roomCode}`);
  });

  // ── Rejoin (reconnect with existing identity) ────────────────────────────
  socket.on('rejoin-room', (payload) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const playerId = sanitizePlayerId(payload?.playerId);

    if (!roomCode || !playerId) {
      return socket.emit('error', { message: 'Valid room code and player ID are required to rejoin.' });
    }

    const result = rejoinPlayer(roomCode, playerId, socket.id);
    if (result.error) return socket.emit('error', { message: result.error });

    socket.join(roomCode);
    const { room, player } = result;

    socket.emit('rejoined', {
      roomCode: room.code,
      playerId: player.id,
      players: _publicPlayers(room),
      phase: room.phase,
      subjectId: room.currentSubjectId,
      subjectNickname: room.players.find(p => p.id === room.currentSubjectId)?.nickname,
      deadline: room.phaseDeadline,
      round: room.round,
      maxRounds: room.maxRounds,
      hostId: room.hostId,
    });

    socket.to(room.code).emit('player-joined', { players: _publicPlayers(room) });
    console.log(`[rejoin]     "${player.nickname}" → ${room.code} (phase: ${room.phase})`);
  });

  // ── Set max rounds ───────────────────────────────────────────────────────
  socket.on('set-max-rounds', (payload) => {
    const roomCode  = sanitizeRoomCode(payload?.roomCode);
    const playerId  = sanitizePlayerId(payload?.playerId);
    const maxRounds = Number(payload?.maxRounds);

    if (!roomCode || !playerId || isNaN(maxRounds)) {
      return socket.emit('error', { message: 'Invalid set-max-rounds payload.' });
    }

    const result = setMaxRounds(roomCode, maxRounds, playerId);
    if (result.error) return socket.emit('error', { message: result.error });
    io.to(roomCode).emit('settings-updated', { maxRounds: result.maxRounds });
  });

  // ── Start game ───────────────────────────────────────────────────────────
  socket.on('start-game', (payload) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const playerId = sanitizePlayerId(payload?.playerId);

    if (!roomCode || !playerId) {
      return socket.emit('error', { message: 'Invalid start-game payload.' });
    }

    const result = startGame(roomCode, playerId, io);
    if (result.error) return socket.emit('error', { message: result.error });
    console.log(`[game]       ${roomCode} started`);
  });

  // ── Submit statements ────────────────────────────────────────────────────
  socket.on('submit-statements', (payload) => {
    const roomCode   = sanitizeRoomCode(payload?.roomCode);
    const playerId   = sanitizePlayerId(payload?.playerId);
    const statements = sanitizeStatements(payload?.statements);

    if (!roomCode || !playerId) {
      return socket.emit('error', { message: 'Invalid submit-statements payload.' });
    }
    if (!statements) {
      return socket.emit('error', { message: 'Statements must be 3 non-empty strings (max 200 chars each).' });
    }

    const result = submitStatements(roomCode, playerId, statements, io);
    if (result.error) return socket.emit('error', { message: result.error });
  });

  // ── Submit vote ──────────────────────────────────────────────────────────
  socket.on('submit-vote', (payload) => {
    const roomCode  = sanitizeRoomCode(payload?.roomCode);
    const playerId  = sanitizePlayerId(payload?.playerId);
    const voteIndex = Number(payload?.voteIndex);

    if (!roomCode || !playerId || ![0, 1, 2].includes(voteIndex)) {
      return socket.emit('error', { message: 'Invalid vote payload.' });
    }

    const result = submitVote(roomCode, playerId, voteIndex, io);
    if (result.error) return socket.emit('error', { message: result.error });
  });

  // ── Advance round (host manual trigger from reveal screen) ───────────────
  socket.on('advance-round', (payload) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const playerId = sanitizePlayerId(payload?.playerId);

    if (!roomCode || !playerId) {
      return socket.emit('error', { message: 'Invalid advance-round payload.' });
    }

    const result = advanceRound(roomCode, playerId, io);
    if (result && result.error) return socket.emit('error', { message: result.error });
  });

  // ── Play again ───────────────────────────────────────────────────────────
  socket.on('play-again', (payload) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const playerId = sanitizePlayerId(payload?.playerId);

    if (!roomCode || !playerId) {
      return socket.emit('error', { message: 'Invalid play-again payload.' });
    }

    const result = resetGame(roomCode, playerId, io);
    if (result.error) return socket.emit('error', { message: result.error });
    console.log(`[game]       ${roomCode} reset for replay`);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[disconnect] ${socket.id} (${reason})`);
    handleDisconnect(socket.id, io);
  });
});

// ─── Uncaught exception guard (last resort — log & keep server alive) ─────────
process.on('uncaughtException', (err) => {
  console.error('[uncaught]  ', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandled] ', reason);
});

// ─── Graceful shutdown (Render sends SIGTERM on every redeploy) ───────────────
function shutdown(signal) {
  console.log(`\n[shutdown]   ${signal} received — closing server gracefully…`);
  // Stop accepting new connections; existing sockets will drain.
  server.close(() => {
    console.log('[shutdown]   HTTP server closed. Exiting.');
    process.exit(0);
  });

  // Disconnect all Socket.io clients so they attempt reconnect on the new instance
  io.disconnectSockets(true);

  // Force-exit after 10 s if something stalls
  setTimeout(() => {
    console.error('[shutdown]   Timeout — forcing exit.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 Two Truths server`);
  console.log(`   Listening on  : http://localhost:${PORT}`);
  console.log(`   Allowed origin: ${CLIENT_URL}\n`);
});
