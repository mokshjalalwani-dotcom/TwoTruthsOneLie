import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket.js';

export default function Home() {
  const navigate = useNavigate();

  // Create room form
  const [createNickname, setCreateNickname] = useState('');
  const [creating, setCreating] = useState(false);

  // Join room form
  const [joinCode, setJoinCode] = useState('');
  const [joinNickname, setJoinNickname] = useState('');
  const [joining, setJoining] = useState(false);

  const [error, setError] = useState('');

  function _connectAndListen() {
    if (!socket.connected) socket.connect();
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!createNickname.trim()) return setError('Enter a nickname to create a room.');
    setError('');
    setCreating(true);
    _connectAndListen();

    socket.emit('create-room', { nickname: createNickname.trim() });

    socket.once('room-created', ({ roomCode, playerId, maxRounds, players }) => {
      localStorage.setItem('tt_roomCode', roomCode);
      localStorage.setItem('tt_playerId', playerId);
      navigate(`/room/${roomCode}`);
    });

    socket.once('error', ({ message }) => {
      setError(message);
      setCreating(false);
    });
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!joinCode.trim()) return setError('Enter a room code.');
    if (!joinNickname.trim()) return setError('Enter a nickname.');
    setError('');
    setJoining(true);
    _connectAndListen();

    socket.emit('join-room', {
      roomCode: joinCode.trim().toUpperCase(),
      nickname: joinNickname.trim(),
    });

    socket.once('room-joined', ({ roomCode, playerId }) => {
      localStorage.setItem('tt_roomCode', roomCode);
      localStorage.setItem('tt_playerId', playerId);
      navigate(`/room/${roomCode}`);
    });

    socket.once('error', ({ message }) => {
      setError(message);
      setJoining(false);
    });
  }

  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>

      {/* Hero */}
      <div className="text-center animate-fade-in" style={{ marginBottom: '48px' }}>
        <div style={{
          fontSize: '3.5rem', marginBottom: '8px',
          animation: 'float 3s ease-in-out infinite',
          display: 'inline-block',
        }}>🎭</div>
        <h1>
          <span className="text-gradient">Two Truths,</span>
          <br />One Room
        </h1>
        <p className="mt-md" style={{ fontSize: '1.1rem', maxWidth: '380px', margin: '12px auto 0' }}>
          Two facts. One lie. Can your friends spot the faker?
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        width: '100%',
        maxWidth: '680px',
      }}>

        {/* Create room */}
        <div className="card card--glow animate-slide-up">
          <div className="flex items-center gap-md mb-md">
            <span style={{ fontSize: '1.5rem' }}>🏠</span>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Create a Room</h2>
              <p className="text-sm text-muted">You'll be the host</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-md">
            <div className="form-group">
              <label htmlFor="create-nickname">Your Nickname</label>
              <input
                id="create-nickname"
                className="input"
                type="text"
                placeholder="e.g. Alex"
                maxLength={20}
                value={createNickname}
                onChange={e => setCreateNickname(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button
              id="btn-create-room"
              type="submit"
              className="btn btn--primary btn--full"
              disabled={creating}
            >
              {creating ? 'Creating…' : '✨ Create Room'}
            </button>
          </form>
        </div>

        {/* Join room */}
        <div className="card animate-slide-up" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-md mb-md">
            <span style={{ fontSize: '1.5rem' }}>🔗</span>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Join a Room</h2>
              <p className="text-sm text-muted">Enter the room code</p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="flex flex-col gap-md">
            <div className="form-group">
              <label htmlFor="join-code">Room Code</label>
              <input
                id="join-code"
                className="input"
                type="text"
                placeholder="e.g. 7K92A"
                maxLength={5}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                style={{ letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase' }}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="join-nickname">Your Nickname</label>
              <input
                id="join-nickname"
                className="input"
                type="text"
                placeholder="e.g. Sam"
                maxLength={20}
                value={joinNickname}
                onChange={e => setJoinNickname(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button
              id="btn-join-room"
              type="submit"
              className="btn btn--secondary btn--full"
              disabled={joining}
            >
              {joining ? 'Joining…' : '🚀 Join Room'}
            </button>
          </form>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="animate-fade-in" style={{
          marginTop: '24px',
          color: 'var(--clr-red)',
          background: 'rgba(244,63,94,0.1)',
          border: '1px solid rgba(244,63,94,0.3)',
          borderRadius: 'var(--r-md)',
          padding: '12px 20px',
          fontWeight: 600,
          maxWidth: '480px',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      <p className="text-muted text-sm text-center" style={{ marginTop: '40px', opacity: 0.5 }}>
        No account needed · Works on mobile · Share the link to invite friends
      </p>
    </div>
  );
}
