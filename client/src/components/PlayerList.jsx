/** Returns initials (up to 2 chars) from a nickname */
function initials(name) {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Reusable player list displayed in the lobby and scoreboard.
 * Props:
 *   players       – array of { id, nickname, score, connected }
 *   hostId        – string
 *   currentSubjectId – string | null
 *   showScores    – bool (default false)
 */
export default function PlayerList({ players = [], hostId, currentSubjectId, showScores = false }) {
  return (
    <ul className="stagger" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {players.map(p => (
        <li
          key={p.id}
          className={`player-pill ${p.connected ? 'player-pill--connected' : 'player-pill--disconnected'} animate-fade-in`}
          style={{ justifyContent: 'space-between' }}
        >
          <div className="flex items-center gap-sm">
            <div className="avatar">{initials(p.nickname)}</div>
            <span style={{ fontWeight: 600 }}>{p.nickname}</span>
            {p.id === hostId && (
              <span className="badge badge--amber" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>HOST</span>
            )}
            {p.id === currentSubjectId && (
              <span className="badge badge--purple" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>✍️</span>
            )}
            {!p.connected && (
              <span className="badge badge--red" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>AWAY</span>
            )}
          </div>
          {showScores && (
            <span className="score-value">{p.score}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
