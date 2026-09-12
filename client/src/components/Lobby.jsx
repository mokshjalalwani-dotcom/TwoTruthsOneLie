import { useState, useRef } from 'react';
import PlayerList from './PlayerList.jsx';

export default function Lobby({ gs, actions, isHost }) {
  const { players, hostId, maxRounds, phase } = gs;
  const roomCode = localStorage.getItem('tt_roomCode') || '';
  const link = `${window.location.origin}/room/${roomCode}`;

  const [copied, setCopied] = useState(false);
  const [localRounds, setLocalRounds] = useState(maxRounds);

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleRoundsChange(e) {
    const val = Number(e.target.value);
    setLocalRounds(val);
    actions.setMaxRounds(val);
  }

  const canStart = players.filter(p => p.connected).length >= 3;

  return (
    <div
      className="animate-fade-in"
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Logo */}
      <div className="text-center">
        <div style={{ fontSize: '2.5rem', animation: 'float 3s ease-in-out infinite', display: 'inline-block' }}>🎭</div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginTop: '4px' }}>
          <span className="text-gradient">Two Truths, One Room</span>
        </h1>
      </div>

      {/* Room code card */}
      <div className="card card--glow text-center">
        <p className="text-muted text-sm" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
          Room Code
        </p>
        <div className="room-code">{roomCode}</div>
        <p className="text-muted text-xs" style={{ margin: '8px 0 16px' }}>
          Share this code or link with your friends
        </p>
        <button
          id="btn-copy-link"
          className="btn btn--secondary"
          onClick={copyLink}
          style={{ gap: '8px' }}
        >
          {copied ? '✅ Copied!' : '📋 Copy Invite Link'}
        </button>
      </div>

      {/* Players card */}
      <div className="card">
        <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.1rem' }}>
            Players
            <span className="badge badge--purple" style={{ marginLeft: '10px', verticalAlign: 'middle' }}>
              {players.filter(p => p.connected).length}
            </span>
          </h2>
          {players.filter(p => p.connected).length < 3 && (
            <span className="text-muted text-sm">Need {3 - players.filter(p => p.connected).length} more</span>
          )}
        </div>
        <PlayerList players={players} hostId={hostId} />
      </div>

      {/* Settings card (host only) */}
      {isHost && (
        <div className="card animate-scale-in">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>⚙️ Game Settings</h2>
          <div className="form-group">
            <label htmlFor="rounds-slider">
              Rounds — <span className="text-gradient fw-black">{localRounds}</span>
            </label>
            <input
              id="rounds-slider"
              type="range"
              min={3}
              max={10}
              step={1}
              value={localRounds}
              onChange={handleRoundsChange}
            />
            <div className="flex justify-between text-xs text-muted" style={{ marginTop: '4px' }}>
              <span>3 (quick)</span><span>10 (marathon)</span>
            </div>
          </div>
        </div>
      )}

      {/* Start button (host only) */}
      {isHost && (
        <button
          id="btn-start-game"
          className="btn btn--primary btn--full btn--lg"
          disabled={!canStart}
          onClick={actions.startGame}
        >
          {canStart ? '🚀 Start Game' : `Waiting for players… (${players.filter(p=>p.connected).length}/3 min)`}
        </button>
      )}

      {!isHost && (
        <div className="card text-center" style={{ padding: '20px' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">Waiting for the host to start the game…</p>
        </div>
      )}

      {/* Leave */}
      <button
        id="btn-leave-room"
        className="btn btn--ghost btn--sm"
        style={{ alignSelf: 'center' }}
        onClick={actions.leaveRoom}
      >
        ← Leave Room
      </button>
    </div>
  );
}
