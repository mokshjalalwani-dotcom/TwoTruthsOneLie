import { useState } from 'react';
import Countdown from './Countdown.jsx';

const EMPTY = { text: '', isLie: false };

export default function Writing({ gs, actions }) {
  const { deadline, round, maxRounds } = gs;

  const [statements, setStatements] = useState([
    { ...EMPTY },
    { ...EMPTY },
    { ...EMPTY },
  ]);
  const [lieIndex, setLieIndex] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function updateText(i, text) {
    setStatements(prev => prev.map((s, idx) => idx === i ? { ...s, text } : s));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (lieIndex === null) return setError('Mark one of your statements as the lie.');
    const empties = statements.filter(s => !s.text.trim());
    if (empties.length > 0) return setError('Fill in all three statements.');

    const payload = statements.map((s, i) => ({ text: s.text.trim(), isLie: i === lieIndex }));
    actions.submitStatements(payload);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="animate-fade-in text-center" style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
        <h2>Statements submitted!</h2>
        <p className="text-muted mt-md">Waiting for everyone else to get ready…</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 0' }}>

      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
        <div>
          <span className="badge badge--purple">Round {round} of {maxRounds}</span>
          <h2 style={{ marginTop: '10px' }}>🎭 You're the Subject!</h2>
          <p className="text-muted mt-sm">Write 2 truths and 1 lie. Mark which one is the lie.</p>
        </div>
        <div className="text-center" style={{ minWidth: '64px' }}>
          <Countdown deadline={deadline} />
          <p className="text-xs text-muted">left</p>
        </div>
      </div>

      <div className="divider" />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {statements.map((s, i) => (
          <div
            key={i}
            className={`card animate-slide-up ${lieIndex === i ? 'card--glow' : ''}`}
            style={{
              animationDelay: `${i * 80}ms`,
              padding: '16px',
              borderColor: lieIndex === i ? 'var(--clr-red)' : undefined,
              boxShadow: lieIndex === i ? '0 0 0 3px rgba(244,63,94,0.2)' : undefined,
            }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '10px' }}>
              <span style={{
                fontWeight: 900,
                fontSize: '1rem',
                background: 'var(--grad-brand)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Statement {String.fromCharCode(65 + i)}
              </span>
              <button
                type="button"
                id={`btn-mark-lie-${i}`}
                onClick={() => setLieIndex(lieIndex === i ? null : i)}
                className={`btn btn--sm ${lieIndex === i ? 'btn--danger' : 'btn--ghost'}`}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                {lieIndex === i ? '🤥 This is the LIE' : 'Mark as Lie'}
              </button>
            </div>
            <textarea
              id={`statement-input-${i}`}
              className="input"
              placeholder={`Write statement ${String.fromCharCode(65 + i)}…`}
              rows={2}
              maxLength={200}
              value={s.text}
              onChange={e => updateText(i, e.target.value)}
            />
            <div className="text-right text-xs text-muted" style={{ marginTop: '4px' }}>
              {s.text.length}/200
            </div>
          </div>
        ))}

        {error && (
          <p className="animate-fade-in" style={{ color: 'var(--clr-red)', fontWeight: 600, textAlign: 'center' }}>
            ⚠️ {error}
          </p>
        )}

        <button
          id="btn-submit-statements"
          type="submit"
          className="btn btn--primary btn--full btn--lg"
          disabled={statements.some(s => !s.text.trim()) || lieIndex === null}
        >
          Submit Statements 🚀
        </button>
      </form>
    </div>
  );
}
