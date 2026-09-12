/**
 * gameLogic.js — Room state machine for "Two Truths, One Room"
 *
 * All phase transitions are server-authoritative.
 * The `io` (Socket.io server) instance is injected so this module
 * can emit events directly when timers fire.
 */

const { generateRoomCode, generatePlayerId, shuffleWithMap, randomFrom } = require('./utils');

// ─── Constants ───────────────────────────────────────────────────────────────
const WRITING_TIMEOUT_MS = 75_000;
const VOTING_TIMEOUT_MS  = 25_000;
const REVEAL_AUTO_ADVANCE_MS = 8_000; // auto-advance to next round after reveal
const GRACE_PERIOD_MS    = 30_000;    // reconnect grace window

const LABELS = ['A', 'B', 'C'];

// ─── In-memory store ──────────────────────────────────────────────────────────
/** @type {Map<string, RoomState>} */
const rooms = new Map();

// Active timers keyed by roomCode (so we can clear them)
const phaseTimers = new Map();     // roomCode → phase setTimeout id
const gracePeriodTimers = new Map(); // `${roomCode}:${playerId}` → setTimeout id

// ─── Room factory ─────────────────────────────────────────────────────────────
function createRoom(hostSocketId, nickname) {
  let code;
  // Ensure uniqueness
  do { code = generateRoomCode(); } while (rooms.has(code));

  const hostId = generatePlayerId();

  /** @type {RoomState} */
  const room = {
    code,
    hostId,
    players: [{
      id: hostId,
      socketId: hostSocketId,
      nickname,
      score: 0,
      connected: true,
      hasBeenSubject: false,
      joinedAt: Date.now(),
    }],
    phase: 'lobby',
    currentSubjectId: null,
    statements: null,   // [{ text, isLie }]
    shuffleMap: null,   // shuffleMap[shuffledIndex] = originalIndex
    votes: {},          // playerId → shuffledIndex they voted as the lie
    round: 0,
    maxRounds: 5,
    phaseDeadline: null,
  };

  rooms.set(code, room);
  return { room, playerId: hostId };
}

// ─── Player management ────────────────────────────────────────────────────────
function addPlayer(roomCode, socketId, nickname) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.phase !== 'lobby') return { error: 'Game already in progress. Wait for the next game.' };

  // Prevent duplicate nicknames
  const taken = room.players.some(p => p.nickname.toLowerCase() === nickname.toLowerCase());
  if (taken) return { error: `Nickname "${nickname}" is already taken in this room.` };

  const playerId = generatePlayerId();
  room.players.push({
    id: playerId,
    socketId,
    nickname,
    score: 0,
    connected: true,
    hasBeenSubject: false,
    joinedAt: Date.now(),
  });

  return { playerId };
}

function rejoinPlayer(roomCode, playerId, newSocketId) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found in this room.' };

  // Cancel any pending grace-period cleanup for this player
  const timerKey = `${roomCode}:${playerId}`;
  if (gracePeriodTimers.has(timerKey)) {
    clearTimeout(gracePeriodTimers.get(timerKey));
    gracePeriodTimers.delete(timerKey);
  }

  player.socketId = newSocketId;
  player.connected = true;

  return { player, room };
}

function setMaxRounds(roomCode, maxRounds, requesterId) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== requesterId) return { error: 'Only the host can change settings.' };
  if (room.phase !== 'lobby') return { error: 'Can only change settings in the lobby.' };
  const clamped = Math.max(3, Math.min(10, Math.round(maxRounds)));
  room.maxRounds = clamped;
  return { maxRounds: clamped };
}

// ─── Phase: lobby → writing ───────────────────────────────────────────────────
function startGame(roomCode, requesterId, io) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== requesterId) return { error: 'Only the host can start the game.' };
  if (room.phase !== 'lobby') return { error: 'Game already started.' };

  const connected = room.players.filter(p => p.connected);
  if (connected.length < 3) return { error: 'Need at least 3 connected players to start.' };

  room.round = 1;
  _beginWritingPhase(room, io);
  return {};
}

function _pickSubject(room) {
  // Prefer players who haven't been Subject yet; once all have, reset flags
  const connected = room.players.filter(p => p.connected);
  let eligible = connected.filter(p => !p.hasBeenSubject);
  if (eligible.length === 0) {
    // Reset — everyone gets another turn
    room.players.forEach(p => { p.hasBeenSubject = false; });
    eligible = connected.filter(p => !p.hasBeenSubject);
  }
  // Exclude current subject from being picked again immediately
  const nonCurrent = eligible.filter(p => p.id !== room.currentSubjectId);
  return randomFrom(nonCurrent.length > 0 ? nonCurrent : eligible);
}

function _beginWritingPhase(room, io) {
  const subject = _pickSubject(room);
  subject.hasBeenSubject = true;
  room.currentSubjectId = subject.id;
  room.statements = null;
  room.shuffleMap = null;
  room.votes = {};
  room.phase = 'writing';
  room.phaseDeadline = Date.now() + WRITING_TIMEOUT_MS;

  io.to(room.code).emit('phase-change', {
    phase: 'writing',
    subjectId: subject.id,
    subjectNickname: subject.nickname,
    deadline: room.phaseDeadline,
    round: room.round,
    maxRounds: room.maxRounds,
  });

  _clearPhaseTimer(room.code);
  phaseTimers.set(room.code, setTimeout(() => {
    const r = rooms.get(room.code);
    if (r && r.phase === 'writing') {
      // Subject ran out of time — skip, use placeholder statements
      r.statements = [
        { text: '(Skipped)', isLie: false },
        { text: '(Skipped)', isLie: false },
        { text: '(Skipped)', isLie: true },
      ];
      _beginVotingPhase(r, io);
    }
  }, WRITING_TIMEOUT_MS));
}

// ─── Phase: writing → voting ──────────────────────────────────────────────────
function submitStatements(roomCode, playerId, statements, io) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.phase !== 'writing') return { error: 'Not in writing phase.' };
  if (room.currentSubjectId !== playerId) return { error: 'You are not the Subject this round.' };
  if (!Array.isArray(statements) || statements.length !== 3) return { error: 'Must submit exactly 3 statements.' };

  const lieCount = statements.filter(s => s.isLie).length;
  if (lieCount !== 1) return { error: 'Exactly one statement must be marked as the lie.' };

  room.statements = statements.map(s => ({
    text: String(s.text).trim(),
    isLie: Boolean(s.isLie),
  }));

  _clearPhaseTimer(room.code);
  _beginVotingPhase(room, io);
  return {};
}

function _beginVotingPhase(room, io) {
  room.phase = 'voting';
  room.phaseDeadline = Date.now() + VOTING_TIMEOUT_MS;

  // Shuffle statements once; store map server-side only
  const { shuffled, shuffleMap } = shuffleWithMap(room.statements);
  room.shuffleMap = shuffleMap; // shuffleMap[shuffledIdx] = originalIdx

  // Broadcast only text + label to non-Subject players (never isLie, never originalIndex)
  const publicStatements = shuffled.map((s, i) => ({ text: s.text, label: LABELS[i] }));

  io.to(room.code).emit('phase-change', {
    phase: 'voting',
    subjectId: room.currentSubjectId,
    subjectNickname: room.players.find(p => p.id === room.currentSubjectId)?.nickname,
    deadline: room.phaseDeadline,
    round: room.round,
    maxRounds: room.maxRounds,
  });

  // Send statements only to non-subject players (subject sees waiting screen)
  room.players.filter(p => p.connected && p.id !== room.currentSubjectId).forEach(p => {
    io.to(p.socketId).emit('statements-ready', { statements: publicStatements });
  });

  _clearPhaseTimer(room.code);
  phaseTimers.set(room.code, setTimeout(() => {
    const r = rooms.get(room.code);
    if (r && r.phase === 'voting') {
      // Auto-fill missing votes with a random shuffled index
      r.players.filter(p => p.connected && p.id !== r.currentSubjectId).forEach(p => {
        if (r.votes[p.id] === undefined) {
          r.votes[p.id] = Math.floor(Math.random() * 3);
        }
      });
      _beginRevealPhase(r, io);
    }
  }, VOTING_TIMEOUT_MS));
}

// ─── Phase: voting ────────────────────────────────────────────────────────────
function submitVote(roomCode, playerId, voteIndex, io) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.phase !== 'voting') return { error: 'Not in voting phase.' };
  if (room.currentSubjectId === playerId) return { error: 'The Subject cannot vote.' };
  if (![0, 1, 2].includes(voteIndex)) return { error: 'Invalid vote index.' };

  room.votes[playerId] = voteIndex;

  // Count eligible voters (connected non-subject)
  const eligible = room.players.filter(p => p.connected && p.id !== room.currentSubjectId);
  const votesIn = eligible.filter(p => room.votes[p.id] !== undefined).length;

  // Broadcast vote progress (count only, no content)
  io.to(room.code).emit('vote-update', { votesIn, totalVoters: eligible.length });

  // Auto-advance if all eligible players have voted
  if (votesIn === eligible.length) {
    _clearPhaseTimer(room.code);
    _beginRevealPhase(room, io);
  }

  return {};
}

// ─── Phase: voting → reveal ───────────────────────────────────────────────────
function _beginRevealPhase(room, io) {
  room.phase = 'reveal';

  // Find the original lie index
  const originalLieIndex = room.statements.findIndex(s => s.isLie);

  // Compute which shuffled index corresponds to the lie
  const shuffledLieIndex = room.shuffleMap.findIndex(origIdx => origIdx === originalLieIndex);

  // Score each voter
  const scoreDelta = {}; // playerId → points earned this round
  const subject = room.players.find(p => p.id === room.currentSubjectId);

  room.players.forEach(p => { scoreDelta[p.id] = 0; });

  let subjectFooledCount = 0;

  Object.entries(room.votes).forEach(([voterId, votedShuffledIndex]) => {
    const voter = room.players.find(p => p.id === voterId);
    if (!voter) return;

    if (votedShuffledIndex === shuffledLieIndex) {
      // Correct — voter gets a point
      voter.score += 1;
      scoreDelta[voterId] = (scoreDelta[voterId] || 0) + 1;
    } else {
      // Wrong — subject fooled them
      subjectFooledCount++;
    }
  });

  if (subject && subjectFooledCount > 0) {
    subject.score += subjectFooledCount;
    scoreDelta[subject.id] = (scoreDelta[subject.id] || 0) + subjectFooledCount;
  }

  // Build the full shuffled statements list (with isLie revealed for clients)
  const { shuffled } = _applyShuffleMap(room.statements, room.shuffleMap);
  const revealedStatements = shuffled.map((s, i) => ({
    text: s.text,
    label: LABELS[i],
    isLie: s.isLie,
  }));

  io.to(room.code).emit('reveal', {
    statements: revealedStatements,
    shuffledLieIndex,
    votes: room.votes,
    scoreDelta,
    players: _publicPlayers(room),
  });

  // Auto-advance to next round / game-over after REVEAL_AUTO_ADVANCE_MS
  _clearPhaseTimer(room.code);
  phaseTimers.set(room.code, setTimeout(() => {
    const r = rooms.get(room.code);
    if (r && r.phase === 'reveal') {
      _advanceRound(r, io);
    }
  }, REVEAL_AUTO_ADVANCE_MS));
}

/** Helper: reconstruct shuffled order from shuffleMap */
function _applyShuffleMap(statements, shuffleMap) {
  const shuffled = shuffleMap.map(origIdx => statements[origIdx]);
  return { shuffled };
}

// ─── Round rotation ───────────────────────────────────────────────────────────
function _advanceRound(room, io) {
  if (room.round >= room.maxRounds) {
    _beginGameOver(room, io);
  } else {
    room.round++;
    _beginWritingPhase(room, io);
  }
}

// ─── Phase: gameover ─────────────────────────────────────────────────────────
function _beginGameOver(room, io) {
  room.phase = 'gameover';
  io.to(room.code).emit('game-over', { players: _publicPlayers(room) });
}

function resetGame(roomCode, requesterId, io) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== requesterId) return { error: 'Only the host can reset the game.' };

  room.phase = 'lobby';
  room.round = 0;
  room.currentSubjectId = null;
  room.statements = null;
  room.shuffleMap = null;
  room.votes = {};
  room.phaseDeadline = null;
  room.players.forEach(p => {
    p.score = 0;
    p.hasBeenSubject = false;
  });

  _clearPhaseTimer(room.code);

  io.to(room.code).emit('phase-change', {
    phase: 'lobby',
    subjectId: null,
    subjectNickname: null,
    deadline: null,
    round: 0,
    maxRounds: room.maxRounds,
  });

  io.to(room.code).emit('player-joined', { players: _publicPlayers(room) });

  return {};
}

// ─── Disconnect / Reconnect ───────────────────────────────────────────────────
function handleDisconnect(socketId, io) {
  // Find which room this socket belongs to
  for (const [code, room] of rooms.entries()) {
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) continue;

    player.connected = false;
    io.to(code).emit('player-left', { players: _publicPlayers(room), disconnectedId: player.id });

    // If subject disconnected during writing — skip immediately
    if (room.phase === 'writing' && room.currentSubjectId === player.id) {
      _clearPhaseTimer(code);
      room.statements = [
        { text: '(Player disconnected)', isLie: false },
        { text: '(Player disconnected)', isLie: false },
        { text: '(Player disconnected)', isLie: true },
      ];
      _beginVotingPhase(room, io);
    }

    // If host disconnected, migrate host
    if (room.hostId === player.id) {
      const nextHost = room.players.find(p => p.connected && p.id !== player.id);
      if (nextHost) {
        room.hostId = nextHost.id;
        io.to(code).emit('host-changed', { newHostId: nextHost.id });
      }
    }

    // Start grace period — if player doesn't reconnect, clean up
    const timerKey = `${code}:${player.id}`;
    if (gracePeriodTimers.has(timerKey)) clearTimeout(gracePeriodTimers.get(timerKey));

    gracePeriodTimers.set(timerKey, setTimeout(() => {
      gracePeriodTimers.delete(timerKey);
      const r = rooms.get(code);
      if (!r) return;

      // Remove the player permanently
      r.players = r.players.filter(p => p.id !== player.id);

      // If room is empty, delete it
      if (r.players.length === 0 || r.players.every(p => !p.connected)) {
        _clearPhaseTimer(code);
        rooms.delete(code);
        return;
      }

      io.to(code).emit('player-left', { players: _publicPlayers(r), disconnectedId: player.id });
    }, GRACE_PERIOD_MS));

    break;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _clearPhaseTimer(roomCode) {
  if (phaseTimers.has(roomCode)) {
    clearTimeout(phaseTimers.get(roomCode));
    phaseTimers.delete(roomCode);
  }
}

/** Strip server-only fields (socketId, etc.) before sending to clients */
function _publicPlayers(room) {
  return room.players.map(p => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    connected: p.connected,
  }));
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function getRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return null;
}

module.exports = {
  createRoom,
  addPlayer,
  rejoinPlayer,
  setMaxRounds,
  startGame,
  submitStatements,
  submitVote,
  advanceRound(roomCode, requesterId, io) {
    const room = rooms.get(roomCode);
    if (!room) return { error: 'Room not found.' };
    if (room.hostId !== requesterId) return { error: 'Only the host can advance the round.' };
    if (room.phase !== 'reveal') return { error: 'Not in reveal phase.' };
    _clearPhaseTimer(room.code);
    _advanceRound(room, io);
    return {};
  },
  resetGame,
  handleDisconnect,
  getRoom,
  getRoomBySocketId,
  _publicPlayers,
};
