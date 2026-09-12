import { useState } from 'react';
import Countdown from './Countdown.jsx';

const LABELS = ['A', 'B', 'C'];

const CONFIDENCE_OPTIONS = [
  {
    id: 'sure',
    label: '🎯 Sure',
    desc: 'Correct +2 · Wrong −1',
    color: 'var(--clr-purple)',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.5)',
  },
  {
    id: 'risky',
    label: '🎲 Risky guess',
    desc: 'Correct +1 · Wrong 0',
    color: 'var(--clr-teal)',
    bg: 'rgba(45,212,191,0.10)',
    border: 'rgba(45,212,191,0.4)',
  },
];

export default function Voting({ gs, actions }) {
  const { statements, deadline, subjectNickname, round, maxRounds, votesIn, totalVoters } = gs;

  // Step 1: pick a statement  →  step 2: pick confidence
  const [selected, setSelected]     = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [confirmed, setConfirmed]   = useState(false);

  function handleConfirm() {
    if (selected === null || !confidence) return;
    actions.submitVote(selected, confidence);
    setConfirmed(true);
  }

  /* ── Confirmed / waiting state ── */
  if (confirmed) {
    return (
      <div className="animate-fade-in text-center" style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🗳️</div>
        <h2>Vote locked in!</h2>
        <p className="text-muted mt-md">
          Statement <strong>{LABELS[selected]}</strong> · {confidence === 'sure' ? '🎯 Sure' : '🎲 Risky'}
        </p>
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

  /* ── Main voting view ── */
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

      {/* Vote progress bar */}
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

      {/* ── Step 1: pick a statement ── */}
      <p className="text-xs text-muted" style={{ marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Step 1 — Pick the lie
      </p>
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {(statements ?? []).map((s, i) => (
          <button
            key={i}
            id={`btn-vote-${LABELS[i]}`}
            className={`statement-card animate-slide-up ${selected === i ? 'selected' : ''}`}
            onClick={() => { setSelected(i); setConfidence(null); }}
            type="button"
          >
            <div className="statement-label">{LABELS[i]}</div>
            <div className="statement-text">{s.text}</div>
          </button>
        ))}
      </div>

      {/* ── Step 2: confidence wager (only shown after picking a statement) ── */}
      {selected !== null && (
        <div className="animate-fade-in" style={{ marginBottom: '20px' }}>
          <p className="text-xs text-muted" style={{ marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Step 2 — How confident are you?
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {CONFIDENCE_OPTIONS.map(opt => {
              const picked = confidence === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`btn-confidence-${opt.id}`}
                  type="button"
                  onClick={() => setConfidence(opt.id)}
                  style={{
                    padding: '14px 12px',
                    borderRadius: 'var(--r-md)',
                    border: `2px solid ${picked ? opt.border : 'rgba(255,255,255,0.08)'}`,
                    background: picked ? opt.bg : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.18s ease',
                    outline: 'none',
                    boxShadow: picked ? `0 0 16px ${opt.bg}` : 'none',
                    transform: picked ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                    {opt.label.split(' ')[0]}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: picked ? opt.color : 'var(--clr-text)', marginBottom: '4px' }}>
                    {opt.label.slice(opt.label.indexOf(' ') + 1)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Confirm button ── */}
      <button
        id="btn-confirm-vote"
        className="btn btn--primary btn--full btn--lg"
        disabled={selected === null || !confidence}
        onClick={handleConfirm}
        style={{ marginTop: '4px' }}
      >
        {selected === null
          ? 'Pick a statement first'
          : !confidence
          ? 'Choose your confidence level'
          : `🗳️ Lock in Statement ${LABELS[selected]} · ${confidence === 'sure' ? 'Sure' : 'Risky'}`
        }
      </button>
    </div>
  );
}
