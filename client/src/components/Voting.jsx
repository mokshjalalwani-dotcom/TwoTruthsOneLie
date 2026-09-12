import { useState } from 'react';
import Countdown from './Countdown.jsx';

export default function Voting({ gs, actions }) {
  const { statements, deadline, subjectNickname, round, maxRounds, votesIn, totalVoters } = gs;

  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleConfirm() {
    if (selected === null) return;
    actions.submitVote(selected);
    setConfirmed(true);
  }

  const LABELS = ['A', 'B', 'C'];

  if (confirmed) {
    return (
      <div className="animate-fade-in text-center" style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🗳️</div>
        <h2>Vote locked in!</h2>
        <p className="text-muted mt-md">Waiting for everyone to vote…</p>
        {totalVoters > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div className="vote-progress" style={{ maxWidth: '240px', margin: '0 auto 8px' }}>
              <div className="vote-progress-fill" style={{ width: `${(votesIn / totalVoters) * 100}%` }} />
            </div>
            <p className="text-muted text-sm">{votesIn} / {totalVoters} voted</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 0' }}>

      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
        <div>
          <span className="badge badge--purple">Round {round} of {maxRounds}</span>
          <h2 style={{ marginTop: '10px' }}>🔍 Spot the Lie</h2>
          <p className="text-muted mt-sm">
            Which statement from <strong style={{ color: 'var(--clr-purple)' }}>{subjectNickname}</strong> is the lie?
          </p>
        </div>
        <div className="text-center" style={{ minWidth: '64px' }}>
          <Countdown deadline={deadline} />
          <p className="text-xs text-muted">left</p>
        </div>
      </div>

      {/* Vote progress */}
      {totalVoters > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div className="vote-progress">
            <div className="vote-progress-fill" style={{ width: `${(votesIn / totalVoters) * 100}%` }} />
          </div>
          <p className="text-xs text-muted" style={{ marginTop: '4px', textAlign: 'right' }}>
            {votesIn} / {totalVoters} voted
          </p>
        </div>
      )}

      <div className="divider" />

      {/* Statement cards */}
      <div
        className="stagger"
        style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0' }}
      >
        {(statements ?? []).map((s, i) => (
          <button
            key={i}
            id={`btn-vote-${LABELS[i]}`}
            className={`statement-card animate-slide-up ${selected === i ? 'selected' : ''}`}
            onClick={() => setSelected(i)}
            type="button"
          >
            <div className="statement-label">{LABELS[i]}</div>
            <div className="statement-text">{s.text}</div>
          </button>
        ))}
      </div>

      <button
        id="btn-confirm-vote"
        className="btn btn--primary btn--full btn--lg"
        disabled={selected === null}
        onClick={handleConfirm}
        style={{ marginTop: '8px' }}
      >
        {selected !== null
          ? `🗳️ Vote for Statement ${LABELS[selected]}`
          : 'Select a statement to vote'}
      </button>
    </div>
  );
}
