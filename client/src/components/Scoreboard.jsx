/**
 * Persistent sidebar scoreboard shown during writing / voting / reveal phases.
 */
export default function Scoreboard({ players = [], currentSubjectId, round, maxRounds }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h3 className="text-gradient" style={{ fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Scoreboard
        </h3>
        <p className="text-muted text-xs" style={{ marginTop: '4px' }}>
          Round {round} of {maxRounds}
        </p>
        {/* Round progress */}
        <div className="vote-progress" style={{ marginTop: '8px' }}>
          <div
            className="vote-progress-fill"
            style={{ width: `${(round / maxRounds) * 100}%` }}
          />
        </div>
      </div>

      {/* Player rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className="score-row animate-fade-in"
            style={{
              opacity: p.connected ? 1 : 0.45,
              borderRadius: 'var(--r-sm)',
              padding: '8px 4px',
            }}
          >
            <div className="flex items-center gap-sm">
              <span style={{ width: '20px', textAlign: 'center', fontSize: '1rem' }}>
                {medals[i] ?? `${i + 1}.`}
              </span>
              <span style={{
                fontWeight: 600,
                fontSize: '0.9rem',
                color: p.id === currentSubjectId ? 'var(--clr-purple)' : 'var(--clr-text)',
              }}>
                {p.nickname}
                {p.id === currentSubjectId && ' ✍️'}
              </span>
            </div>
            <span className="score-value">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
