import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket.js';
import Lobby       from '../components/Lobby.jsx';
import Writing     from '../components/Writing.jsx';
import Waiting     from '../components/Waiting.jsx';
import Voting      from '../components/Voting.jsx';
import Reveal      from '../components/Reveal.jsx';
import GameOver    from '../components/GameOver.jsx';
import Scoreboard  from '../components/Scoreboard.jsx';
import LiveToolbar from '../components/LiveToolbar.jsx';

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();

  // ─── Core game state ───────────────────────────────────────────
  const [gameState, setGameState] = useState({
    phase: 'connecting',
    players: [],
    hostId: null,
    playerId: null,
    subjectId: null,
    subjectNickname: null,
    round: 0,
    maxRounds: 5,
    deadline: null,
    category: null,
    templates: null,
    allTemplates: null,   // { en: string[], hi: string[] }
    typingInfo: null,
    statements: null,
    revealData: null,
    votesIn: 0,
    totalVoters: 0,
  });

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [chatMessages, setChatMessages]   = useState([]);
  const [peerIds, setPeerIds]             = useState([]);

  // ─── Helpers ───────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const isHost    = gameState.playerId === gameState.hostId;
  const isSubject = gameState.playerId === gameState.subjectId;

  // ─── Socket setup + reconnect logic ────────────────────────────
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const savedPlayerId = localStorage.getItem('tt_playerId');
    const savedCode     = localStorage.getItem('tt_roomCode');

    if (savedPlayerId && savedCode === code.toUpperCase()) {
      socket.emit('rejoin-room', { roomCode: code.toUpperCase(), playerId: savedPlayerId });
    }

    socket.on('rejoined', (data) => {
      localStorage.setItem('tt_playerId', data.playerId);
      localStorage.setItem('tt_roomCode', data.roomCode);
      setGameState(prev => ({
        ...prev,
        phase: data.phase,
        players: data.players,
        hostId: data.hostId,
        playerId: data.playerId,
        subjectId: data.subjectId,
        subjectNickname: data.subjectNickname,
        round: data.round,
        maxRounds: data.maxRounds,
        deadline: data.deadline,
        category: data.category ?? null,
        templates: data.templates ?? null,
        allTemplates: data.allTemplates ?? null,
        typingInfo: null,
      }));
    });

    socket.on('player-joined', ({ players }) => {
      setGameState(prev => ({ ...prev, players }));
    });

    socket.on('player-left', ({ players }) => {
      setGameState(prev => ({ ...prev, players }));
    });

    socket.on('host-changed', ({ newHostId }) => {
      setGameState(prev => ({ ...prev, hostId: newHostId }));
      showToast('👑 Host has changed');
    });

    socket.on('settings-updated', ({ maxRounds }) => {
      setGameState(prev => ({ ...prev, maxRounds }));
    });

    socket.on('phase-change', (data) => {
      setGameState(prev => ({
        ...prev,
        phase: data.phase,
        subjectId: data.subjectId,
        subjectNickname: data.subjectNickname,
        deadline: data.deadline,
        round: data.round,
        maxRounds: data.maxRounds,
        category: data.category ?? null,
        templates: data.templates ?? null,
        allTemplates: data.allTemplates ?? null,
        typingInfo: null,
        statements: null,
        revealData: null,
        votesIn: 0,
        totalVoters: 0,
      }));
    });

    socket.on('subject-typing', (data) => {
      setGameState(prev => ({ ...prev, typingInfo: data }));
    });

    socket.on('statements-ready', ({ statements }) => {
      setGameState(prev => ({ ...prev, statements }));
    });

    socket.on('vote-update', ({ votesIn, totalVoters }) => {
      setGameState(prev => ({ ...prev, votesIn, totalVoters }));
    });

    socket.on('reveal', (data) => {
      setGameState(prev => ({
        ...prev,
        phase: 'reveal',
        revealData: data,
        players: data.players,
      }));
    });

    socket.on('game-over', ({ players }) => {
      setGameState(prev => ({ ...prev, phase: 'gameover', players }));
    });

    socket.on('error', ({ message }) => {
      setError(message);
      if (message.includes('already in progress')) {
        setTimeout(() => navigate('/'), 2500);
      }
    });

    // ─── Chat ────────────────────────────────────────────────────
    socket.on('chat-message', (msg) => {
      setChatMessages(prev => [...prev.slice(-99), msg]);
    });

    // ─── PeerJS peer list ────────────────────────────────────────
    socket.on('peer-list', ({ peerIds: ids }) => {
      setPeerIds(ids);
    });

    return () => {
      socket.off('rejoined');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('host-changed');
      socket.off('settings-updated');
      socket.off('phase-change');
      socket.off('subject-typing');
      socket.off('statements-ready');
      socket.off('vote-update');
      socket.off('reveal');
      socket.off('game-over');
      socket.off('error');
      socket.off('chat-message');
      socket.off('peer-list');
    };
  }, [code, navigate, showToast]);

  // ─── Actions passed down to phase components ───────────────────
  const actions = {
    startGame() {
      socket.emit('start-game', { roomCode: code.toUpperCase(), playerId: gameState.playerId });
    },
    setMaxRounds(maxRounds) {
      socket.emit('set-max-rounds', { roomCode: code.toUpperCase(), playerId: gameState.playerId, maxRounds });
    },
    submitStatements(statements) {
      socket.emit('submit-statements', { roomCode: code.toUpperCase(), playerId: gameState.playerId, statements });
    },
    submitVote(voteIndex, confidence) {
      socket.emit('submit-vote', { roomCode: code.toUpperCase(), playerId: gameState.playerId, voteIndex, confidence });
    },
    playAgain() {
      socket.emit('play-again', { roomCode: code.toUpperCase(), playerId: gameState.playerId });
    },
    nextRound() {
      socket.emit('advance-round', { roomCode: code.toUpperCase(), playerId: gameState.playerId });
    },
    leaveRoom() {
      localStorage.removeItem('tt_playerId');
      localStorage.removeItem('tt_roomCode');
      socket.disconnect();
      navigate('/');
    },
    sendChat(text) {
      socket.emit('chat-message', {
        roomCode: code.toUpperCase(),
        playerId: gameState.playerId,
        text,
      });
    },
    callReady() {
      socket.emit('call-ready', { roomCode: code.toUpperCase(), playerId: gameState.playerId });
    },
    callLeave() {
      socket.emit('call-leave', { roomCode: code.toUpperCase(), playerId: gameState.playerId });
    },
  };

  // ─── Render active phase ───────────────────────────────────────
  function renderPhase() {
    const { phase } = gameState;

    if (phase === 'connecting') {
      return (
        <div className="flex flex-col items-center justify-center" style={{ flex: 1, gap: '16px' }}>
          <div className="spinner" />
          <p>Connecting to room <strong>{code.toUpperCase()}</strong>…</p>
        </div>
      );
    }

    if (phase === 'lobby')   return <Lobby   gs={gameState} actions={actions} isHost={isHost} />;
    if (phase === 'writing') return isSubject
      ? <Writing  gs={gameState} actions={actions} />
      : <Waiting  gs={gameState} />;
    if (phase === 'voting')  return isSubject
      ? <Waiting  gs={gameState} isSubjectWaiting />
      : <Voting   gs={gameState} actions={actions} />;
    if (phase === 'reveal')  return <Reveal   gs={gameState} actions={actions} isHost={isHost} isSubject={isSubject} />;
    if (phase === 'gameover') return <GameOver gs={gameState} actions={actions} isHost={isHost} />;

    return null;
  }

  // ─── Layout ────────────────────────────────────────────────────
  const showSidebar   = !['lobby', 'connecting'].includes(gameState.phase);
  const showLiveTools = !['lobby', 'connecting', 'gameover'].includes(gameState.phase);

  return (
    <div className="page">
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Error banner */}
      {error && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: 'rgba(244,63,94,0.15)',
          borderBottom: '1px solid rgba(244,63,94,0.4)',
          padding: '12px 24px',
          textAlign: 'center', fontWeight: 600, color: 'var(--clr-red)',
        }}>
          {error}
          <button
            onClick={() => setError('')}
            style={{ marginLeft: '16px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
          >✕</button>
        </div>
      )}

      <div className={showSidebar ? 'game-layout' : ''} style={{ flex: 1 }}>
        <main className="game-main" style={{ position: 'relative', zIndex: 1 }}>
          {renderPhase()}
        </main>

        {showSidebar && (
          <aside className="scoreboard-panel scoreboard" style={{ padding: '24px 16px' }}>
            <Scoreboard
              players={gameState.players}
              currentSubjectId={gameState.subjectId}
              round={gameState.round}
              maxRounds={gameState.maxRounds}
            />
          </aside>
        )}
      </div>

      {/* Unified floating toolbar: Chat + Video — shown during all active game phases */}
      {showLiveTools && (
        <LiveToolbar
          playerId={gameState.playerId}
          players={gameState.players}
          peerIds={peerIds}
          messages={chatMessages}
          onSend={actions.sendChat}
          onCallReady={actions.callReady}
          onCallLeave={actions.callLeave}
        />
      )}
    </div>
  );
}
