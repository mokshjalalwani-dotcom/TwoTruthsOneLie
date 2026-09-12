import { useEffect, useState } from 'react';

const LABELS = ['A', 'B', 'C'];

export default function Reveal({ gs, actions, isHost, isSubject }) {
  const { revealData, players, round, maxRounds } = gs;
  const { statements, shuffledLieIndex, votes, scoreDelta } = revealData ?? {};

  // Animate score deltas in sequence
  const [visibleDeltas, setVisibleDeltas] = useState([]);

  useEffect(() => {
    if (!scoreDelta) return;
    const entries = Object.entries(scoreDelta).filter(([, pts]) => pts > 0);
    entries.forEach(([pid, pts], i) => {
      setTimeout(() => {
        setVisibleDeltas(prev => [...prev, { pid, pts }]);
      }, 600 + i * 400);
    });
  }, [scoreDelta]);

  function getNickname(pid) {
    return players?.find(p => p.id === pid)?.nickname ?? 'Unknown';
  }

  const isLastRound = round >= maxRounds;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 0' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <span className="badge badge--purple">Round {round} of {maxRounds}</span>
        <h2 style={{ marginTop: '10px' }}>🎉 Reveal!</h2>
        <p className="text-muted mt-sm">
          Here's what <strong style={{ color: 'var(--clr-purple)' }}>{gs.subjectNickname}</strong> wrote:
        </p>
      </div>

      {/* Statement cards */}
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {(statements ?? []).map((s, i) => (
          <div
            key={i}
            className={`statement-card animate-slide-up ${s.isLie ? 'lie' : 'truth'}`}
            style={{ cursor: 'default', pointerEvents: 'none' }}
          >
            <div className="statement-label" style={{
              background: s.isLie ? 'var(--grad-danger)' : 'var(--grad-success)',
            }}>
              {LABELS[i]}
            </div>
            <div style={{ flex: 1 }}>
              <div className="statement-text">{s.text}</div>
              <div className="text-xs" style={{
                marginTop: '6px',
                fontWeight: 700,
                color: s.isLie ? 'var(--clr-red)' : 'var(--clr-green)',
              }}>
                {s.isLie ? '🤥 THE LIE' : '✅ Truth'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Who voted for what */}
      {votes && Object.keys(votes).length > 0 && (
        <div className="card animate-slide-up" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Votes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(votes).map(([pid, votedIdx]) => {
              const correct = votedIdx === shuffledLieIndex;
              return (
                <div key={pid} className="flex justify-between items-center" style={{ fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 600 }}>{getNickname(pid)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge--purple" style={{ fontSize: '0.7rem' }}>
                      {LABELS[votedIdx]}
                    </span>
                    <span style={{ color: correct ? 'var(--clr-green)' : 'var(--clr-red)', fontWeight: 700 }}>
                      {correct ? '✅ Correct' : '❌ Fooled'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Animated score deltas */}
      {visibleDeltas.length > 0 && (
        <div className="card animate-fade-in" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '12px' }}>🏆 Points this round</h3>
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {visibleDeltas.map(({ pid, pts }, i) => (
              <div key={pid} className="flex justify-between items-center animate-slide-up" style={{ fontSize: '0.95rem' }}>
                <span style={{ fontWeight: 600 }}>{getNickname(pid)}</span>
                <span style={{ color: 'var(--clr-green)', fontWeight: 900, fontSize: '1.1rem' }}>
                  +{pts} pt{pts !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next round / Game over (host only) */}
      {isHost && (
        <button
          id={isLastRound ? 'btn-see-results' : 'btn-next-round'}
          className="btn btn--primary btn--full btn--lg"
          onClick={actions.nextRound}
          style={{ marginTop: '8px' }}
        >
          {isLastRound ? '🏁 See Final Results' : '▶ Next Round'}
        </button>
      )}

      {!isHost && (
        <p className="text-muted text-center text-sm" style={{ marginTop: '16px' }}>
          Waiting for the host to continue…
        </p>
      )}
    </div>
  );
}
