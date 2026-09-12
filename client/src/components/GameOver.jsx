export default function GameOver({ gs, actions, isHost }) {
  const { players } = gs;
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const medals  = ['🥇', '🥈', '🥉'];
  const rankClasses = ['rank-1', 'rank-2', 'rank-3'];

  const winner = sorted[0];

  return (
    <div
      className="animate-fade-in text-center"
      style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 16px' }}
    >
      {/* Hero */}
      <div style={{ fontSize: '3.5rem', animation: 'float 2.5s ease-in-out infinite', display: 'inline-block' }}>
        🏆
      </div>
      <h1 style={{ marginTop: '12px', fontSize: 'clamp(1.6rem, 5vw, 2.4rem)' }}>
        Game Over!
      </h1>
      {winner && (
        <p className="mt-sm" style={{ fontSize: '1.1rem' }}>
          <strong style={{ color: 'var(--clr-amber)' }}>{winner.nickname}</strong> wins with{' '}
          <strong className="text-gradient">{winner.score} point{winner.score !== 1 ? 's' : ''}</strong>! 🎉
        </p>
      )}

      {/* Leaderboard */}
      <div className="card card--glow animate-slide-up" style={{ marginTop: '32px', textAlign: 'left' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '16px', textAlign: 'center' }}>Final Standings</h2>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column' }}>
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`score-row animate-slide-up ${rankClasses[i] ?? ''}`}
              style={{
                padding: '14px 8px',
                background: i === 0 ? 'rgba(251,191,36,0.06)' : 'transparent',
                borderRadius: i === 0 ? 'var(--r-sm)' : 0,
              }}
            >
              <div className="flex items-center gap-md">
                <span style={{ fontSize: '1.4rem', minWidth: '32px', textAlign: 'center' }}>
                  {medals[i] ?? `${i + 1}`}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{p.nickname}</div>
                  {!p.connected && (
                    <div className="text-xs text-muted">disconnected</div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="score-value" style={{ fontSize: '1.4rem' }}>{p.score}</div>
                <div className="text-xs text-muted">pts</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '28px' }}>
        {isHost && (
          <button
            id="btn-play-again"
            className="btn btn--primary btn--full btn--lg"
            onClick={actions.playAgain}
          >
            🔄 Play Again
          </button>
        )}
        {!isHost && (
          <p className="text-muted text-sm">Waiting for the host to start another game…</p>
        )}
        <button
          id="btn-go-home"
          className="btn btn--ghost btn--sm"
          style={{ alignSelf: 'center' }}
          onClick={actions.leaveRoom}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
