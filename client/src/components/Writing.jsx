import { useState, useRef } from 'react';
import Countdown from './Countdown.jsx';
import socket from '../socket.js';

const LABELS = ['A', 'B', 'C'];
const TYPING_THROTTLE_MS = 400;

/**
 * Splits a template string on '___' into [prefix, suffix].
 * Returns the full statement text when given the user's fill-in value.
 */
function splitTemplate(template) {
  const idx = template.indexOf('___');
  if (idx === -1) return { prefix: template, suffix: '' };
  return { prefix: template.slice(0, idx), suffix: template.slice(idx + 3) };
}

function composeText(template, fill) {
  const { prefix, suffix } = splitTemplate(template);
  return (prefix + fill.trim() + suffix).trim();
}

export default function Writing({ gs, actions }) {
  const { deadline, round, maxRounds, category, templates } = gs;

  // fills[i] = what the user typed into the blank of template i
  const [fills, setFills] = useState(['', '', '']);
  const [lieIndex, setLieIndex] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const lastTypingEmit = useRef(0);
  const roomCode = localStorage.getItem('tt_roomCode') || '';
  const playerId = localStorage.getItem('tt_playerId') || '';

  function updateFill(i, value) {
    setFills(prev => prev.map((f, idx) => idx === i ? value : f));

    // Throttled typing indicator
    const now = Date.now();
    if (now - lastTypingEmit.current > TYPING_THROTTLE_MS) {
      lastTypingEmit.current = now;
      socket.emit('typing-update', {
        roomCode,
        playerId,
        fieldIndex: i,
        charCount: value.length,
      });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (lieIndex === null) return setError('Mark one of your statements as the lie.');

    const texts = (templates ?? []).map((t, i) => composeText(t, fills[i]));
    if (texts.some(t => t.length < 2)) return setError('Fill in all the blanks first.');

    const payload = texts.map((text, i) => ({ text, isLie: i === lieIndex }));
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
    <div className="animate-fade-in" style={{ maxWidth: '580px', margin: '0 auto', padding: '24px 0' }}>

      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
        <div>
          <span className="badge badge--purple">Round {round} of {maxRounds}</span>
          <h2 style={{ marginTop: '10px' }}>🎭 You're the Subject!</h2>
          <p className="text-muted mt-sm">Fill in the blanks — mark one as the lie.</p>
        </div>
        <div className="text-center" style={{ minWidth: '64px' }}>
          <Countdown deadline={deadline} />
          <p className="text-xs text-muted">left</p>
        </div>
      </div>

      {/* Category badge */}
      {category && (
        <div
          className="animate-scale-in"
          style={{
            margin: '16px 0 8px',
            padding: '12px 18px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(45,212,191,0.08)',
            border: '1px solid rgba(45,212,191,0.3)',
            boxShadow: '0 0 24px rgba(45,212,191,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>💡</span>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--clr-teal)', marginBottom: '2px' }}>
              This round's theme
            </p>
            <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--clr-text)' }}>{category}</p>
          </div>
        </div>
      )}

      <div className="divider" />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {(templates ?? ['___', '___', '___']).map((template, i) => {
          const { prefix, suffix } = splitTemplate(template);
          const isLie = lieIndex === i;

          return (
            <div
              key={i}
              className={`card animate-slide-up ${isLie ? 'card--glow' : ''}`}
              style={{
                animationDelay: `${i * 80}ms`,
                padding: '16px',
                borderColor: isLie ? 'var(--clr-red)' : undefined,
                boxShadow: isLie ? '0 0 0 3px rgba(244,63,94,0.2)' : undefined,
              }}
            >
              {/* Label + Lie toggle */}
              <div className="flex justify-between items-center" style={{ marginBottom: '12px' }}>
                <span style={{
                  fontWeight: 900,
                  fontSize: '1rem',
                  background: 'var(--grad-brand)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  Statement {LABELS[i]}
                </span>
                <button
                  type="button"
                  id={`btn-mark-lie-${i}`}
                  onClick={() => setLieIndex(isLie ? null : i)}
                  className={`btn btn--sm ${isLie ? 'btn--danger' : 'btn--ghost'}`}
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  {isLie ? '🤥 This is the LIE' : 'Mark as Lie'}
                </button>
              </div>

              {/* Fill-in-the-blank input row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  padding: '4px 0',
                }}
              >
                {prefix && (
                  <span style={{ color: 'var(--clr-text)', fontStyle: 'italic' }}>{prefix}</span>
                )}
                <input
                  id={`statement-fill-${i}`}
                  className="input"
                  style={{
                    flex: '1 1 120px',
                    minWidth: '100px',
                    padding: '6px 10px',
                    fontSize: '0.95rem',
                    borderRadius: 'var(--r-sm)',
                    border: '2px solid',
                    borderColor: isLie ? 'rgba(244,63,94,0.5)' : 'rgba(139,92,246,0.4)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--clr-text)',
                    outline: 'none',
                  }}
                  placeholder="fill in…"
                  maxLength={120}
                  value={fills[i]}
                  onChange={e => updateFill(i, e.target.value)}
                />
                {suffix && (
                  <span style={{ color: 'var(--clr-text)', fontStyle: 'italic' }}>{suffix}</span>
                )}
              </div>
              <div className="text-right text-xs text-muted" style={{ marginTop: '4px' }}>
                {fills[i].length}/120
              </div>
            </div>
          );
        })}

        {error && (
          <p className="animate-fade-in" style={{ color: 'var(--clr-red)', fontWeight: 600, textAlign: 'center' }}>
            ⚠️ {error}
          </p>
        )}

        <button
          id="btn-submit-statements"
          type="submit"
          className="btn btn--primary btn--full btn--lg"
          disabled={fills.some(f => !f.trim()) || lieIndex === null}
        >
          Submit Statements 🚀
        </button>
      </form>
    </div>
  );
}
