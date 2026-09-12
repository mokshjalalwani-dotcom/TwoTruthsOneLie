import Countdown from './Countdown.jsx';

/**
 * Shown to:
 *  - Non-subject players during writing phase
 *  - The subject player during voting phase (isSubjectWaiting=true)
 */
export default function Waiting({ gs, isSubjectWaiting = false }) {
  const { subjectNickname, deadline, round, maxRounds, category } = gs;

  const message = isSubjectWaiting
    ? 'Players are voting on your statements…'
    : `Waiting for ${subjectNickname ?? 'the Subject'} to write their statements…`;

  const emoji = isSubjectWaiting ? '🗳️' : '✍️';

  return (
    <div
      className="animate-fade-in text-center"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '20px',
        padding: '24px',
      }}
    >
      <span className="badge badge--purple">Round {round} of {maxRounds}</span>

      {/* Animated emoji */}
      <div style={{
        fontSize: '4rem',
        animation: 'float 2.5s ease-in-out infinite',
        display: 'inline-block',
      }}>
        {emoji}
      </div>

      <h2 style={{ maxWidth: '340px', lineHeight: 1.3 }}>{message}</h2>

      {/* Category hint — shown to waiting players only, not to the subject during voting */}
      {!isSubjectWaiting && category && (
        <div
          className="animate-scale-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 18px',
            borderRadius: 'var(--r-full)',
            background: 'rgba(45,212,191,0.08)',
            border: '1px solid rgba(45,212,191,0.25)',
          }}
        >
          <span style={{ fontSize: '1rem' }}>💡</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--clr-text-muted)' }}>
            Writing about:{' '}
            <strong style={{ color: 'var(--clr-teal)', fontWeight: 800 }}>{category}</strong>
          </span>
        </div>
      )}

      {/* Countdown */}
      <div className="card" style={{ padding: '20px 40px', textAlign: 'center' }}>
        <Countdown deadline={deadline} />
        <p className="text-muted text-sm" style={{ marginTop: '6px' }}>seconds remaining</p>
      </div>

      {/* Pulsing dots */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {[0,1,2].map(i => (
          <div
            key={i}
            style={{
              width: '8px', height: '8px',
              borderRadius: '50%',
              background: 'var(--clr-purple)',
              animation: `pulse-urgent 0.8s ease-in-out ${i * 0.2}s infinite alternate`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </div>
  );
}
