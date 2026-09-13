import { useState, useRef } from 'react';
import Countdown from './Countdown.jsx';
import socket from '../socket.js';

const LABELS = ['A', 'B', 'C'];
const TYPING_THROTTLE_MS = 400;

/**
 * Splits a template string on '___' into [prefix, suffix].
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

const LANG_OPTIONS = [
  {
    value: 'en',
    label: 'English',
    flag: '🇬🇧',
    desc: 'Classic game — fill in the blanks in English',
  },
  {
    value: 'hi',
    label: 'Hinglish',
    flag: '🇮🇳',
    desc: 'Same game, Hindi + English mix — ekdum desi style!',
  },
];

export default function Writing({ gs, actions }) {
  const { deadline, round, maxRounds, category, allTemplates } = gs;

  // ─── Step 1: language selection ─────────────────────────────────
  const [lang, setLang] = useState(null); // null = not yet chosen

  // ─── Step 2: per-statement state ────────────────────────────────
  // selectedTemplate[i] = the chosen template string for slot i
  const [selectedTemplates, setSelectedTemplates] = useState([null, null, null]);
  // fills[i] = what the user typed into the blank
  const [fills, setFills] = useState(['', '', '']);
  const [lieIndex, setLieIndex] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const lastTypingEmit = useRef(0);
  const roomCode = localStorage.getItem('tt_roomCode') || '';
  const playerId = localStorage.getItem('tt_playerId') || '';

  // Pool of templates for the chosen language
  const templatePool = lang ? (allTemplates?.[lang] ?? gs.templates ?? []) : [];

  function chooseLanguage(l) {
    setLang(l);
    // Pre-select the first 3 templates in the pool as defaults
    const pool = allTemplates?.[l] ?? gs.templates ?? [];
    setSelectedTemplates([pool[0] ?? null, pool[1] ?? null, pool[2] ?? null]);
    setFills(['', '', '']);
    setLieIndex(null);
  }

  function setTemplate(i, tpl) {
    setSelectedTemplates(prev => prev.map((t, idx) => idx === i ? tpl : t));
    setFills(prev => prev.map((f, idx) => idx === i ? '' : f));
  }

  function updateFill(i, value) {
    setFills(prev => prev.map((f, idx) => idx === i ? value : f));
    const now = Date.now();
    if (now - lastTypingEmit.current > TYPING_THROTTLE_MS) {
      lastTypingEmit.current = now;
      socket.emit('typing-update', { roomCode, playerId, fieldIndex: i, charCount: value.length });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (lieIndex === null) return setError('Mark one of your statements as the lie.');
    if (selectedTemplates.some(t => !t)) return setError('Choose a template for each statement.');

    const texts = selectedTemplates.map((t, i) => composeText(t, fills[i]));
    if (texts.some(t => t.length < 2)) return setError('Fill in all the blanks first.');

    const payload = texts.map((text, i) => ({ text, isLie: i === lieIndex }));
    actions.submitStatements(payload);
    setSubmitted(true);
  }

  // ─── Submitted view ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="animate-fade-in text-center" style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
        <h2>Statements submitted!</h2>
        <p className="text-muted mt-md">Waiting for everyone else to get ready…</p>
      </div>
    );
  }

  // ─── Step 1: Language picker ────────────────────────────────────
  if (!lang) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 0' }}>

        {/* Header */}
        <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
          <div>
            <span className="badge badge--purple">Round {round} of {maxRounds}</span>
            <h2 style={{ marginTop: '10px' }}>🎭 You're the Subject!</h2>
            <p className="text-muted mt-sm">First, pick your language — then fill in your statements.</p>
          </div>
          <div className="text-center" style={{ minWidth: '64px' }}>
            <Countdown deadline={deadline} />
            <p className="text-xs text-muted">left</p>
          </div>
        </div>

        {/* Category badge */}
        {category && (
          <div className="animate-scale-in" style={{
            margin: '16px 0 24px',
            padding: '12px 18px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(45,212,191,0.08)',
            border: '1px solid rgba(45,212,191,0.3)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
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

        <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', marginBottom: '20px', color: 'var(--clr-text)' }}>
          🌐 Choose your statement language
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {LANG_OPTIONS.map(opt => (
            <button
              key={opt.value}
              id={`btn-lang-${opt.value}`}
              type="button"
              onClick={() => chooseLanguage(opt.value)}
              style={{
                background: 'rgba(18,18,42,0.8)',
                border: '2px solid rgba(139,92,246,0.25)',
                borderRadius: 'var(--r-lg)',
                padding: '28px 20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.22s ease',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.8)';
                e.currentTarget.style.background = 'rgba(139,92,246,0.12)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(139,92,246,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)';
                e.currentTarget.style.background = 'rgba(18,18,42,0.8)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '2.8rem' }}>{opt.flag}</span>
              <span style={{
                fontWeight: 900, fontSize: '1.15rem',
                background: 'var(--grad-brand)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{opt.label}</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step 2: Statement forms ────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 0' }}>

      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="badge badge--purple">Round {round} of {maxRounds}</span>
            {/* Language badge + change button */}
            <button
              type="button"
              onClick={() => setLang(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: 'var(--r-full)',
                border: '1px solid rgba(45,212,191,0.4)',
                background: 'rgba(45,212,191,0.08)',
                color: 'var(--clr-teal)', fontWeight: 700, fontSize: '0.78rem',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {lang === 'hi' ? '🇮🇳 Hinglish' : '🇬🇧 English'} · <span style={{ opacity: 0.7 }}>change</span>
            </button>
          </div>
          <h2 style={{ marginTop: '10px' }}>🎭 You're the Subject!</h2>
          <p className="text-muted mt-sm">Pick a template, fill the blank — mark one as the lie.</p>
        </div>
        <div className="text-center" style={{ minWidth: '64px' }}>
          <Countdown deadline={deadline} />
          <p className="text-xs text-muted">left</p>
        </div>
      </div>

      {/* Category badge */}
      {category && (
        <div className="animate-scale-in" style={{
          margin: '16px 0 8px',
          padding: '12px 18px',
          borderRadius: 'var(--r-md)',
          background: 'rgba(45,212,191,0.08)',
          border: '1px solid rgba(45,212,191,0.3)',
          boxShadow: '0 0 24px rgba(45,212,191,0.08)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '1.2rem' }}>💡</span>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--clr-teal)', marginBottom: '2px' }}>
              {lang === 'hi' ? 'Is round ka theme' : "This round's theme"}
            </p>
            <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--clr-text)' }}>{category}</p>
          </div>
        </div>
      )}

      <div className="divider" />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {[0, 1, 2].map(i => {
          const tpl   = selectedTemplates[i];
          const isLie = lieIndex === i;
          const { prefix, suffix } = tpl ? splitTemplate(tpl) : { prefix: '', suffix: '' };
          const fill  = fills[i];
          const preview = tpl ? composeText(tpl, fill || '…') : '';

          return (
            <div
              key={i}
              className={`card animate-slide-up ${isLie ? 'card--glow' : ''}`}
              style={{
                animationDelay: `${i * 80}ms`,
                padding: '20px',
                borderColor: isLie ? 'var(--clr-red)' : undefined,
                boxShadow: isLie ? '0 0 0 3px rgba(244,63,94,0.2)' : undefined,
              }}
            >
              {/* Label + Lie toggle */}
              <div className="flex justify-between items-center" style={{ marginBottom: '14px' }}>
                <span style={{
                  fontWeight: 900, fontSize: '1rem',
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

              {/* Template dropdown */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label htmlFor={`tpl-select-${i}`} style={{ color: 'var(--clr-teal)', marginBottom: '6px' }}>
                  {lang === 'hi' ? '📋 Template chuno' : '📋 Choose a template'}
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    id={`tpl-select-${i}`}
                    value={tpl ?? ''}
                    onChange={e => setTemplate(i, e.target.value || null)}
                    style={{
                      width: '100%',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      background: 'rgba(18,18,42,0.9)',
                      border: `2px solid ${isLie ? 'rgba(244,63,94,0.5)' : 'rgba(139,92,246,0.4)'}`,
                      borderRadius: 'var(--r-md)',
                      color: tpl ? 'var(--clr-text)' : 'var(--clr-text-dim)',
                      fontFamily: 'inherit',
                      fontSize: '0.92rem',
                      padding: '10px 40px 10px 14px',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      lineHeight: 1.5,
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--clr-purple)';
                      e.target.style.boxShadow = '0 0 0 3px var(--clr-purple-glow)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = isLie ? 'rgba(244,63,94,0.5)' : 'rgba(139,92,246,0.4)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="" style={{ background: '#12122a' }}>
                      {lang === 'hi' ? '— template select karo —' : '— select a template —'}
                    </option>
                    {templatePool.map((t, ti) => (
                      <option
                        key={ti}
                        value={t}
                        style={{ background: '#12122a', color: '#f0f0ff' }}
                      >
                        {t}
                      </option>
                    ))}
                  </select>
                  {/* Custom arrow */}
                  <span style={{
                    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                    pointerEvents: 'none', color: 'var(--clr-purple)', fontSize: '1rem',
                  }}>▾</span>
                </div>
              </div>

              {/* Fill-in-the-blank input — shown only when template chosen */}
              {tpl && (
                <>
                  <div className="form-group">
                    <label htmlFor={`fill-${i}`} style={{ color: 'var(--clr-purple)', marginBottom: '6px' }}>
                      {lang === 'hi' ? '✏️ Blank bharo' : '✏️ Fill in the blank'}
                    </label>

                    {/* Template context shown above input */}
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--r-sm)',
                      background: 'rgba(139,92,246,0.07)',
                      border: '1px dashed rgba(139,92,246,0.25)',
                      fontSize: '0.88rem',
                      color: 'var(--clr-text-muted)',
                      fontStyle: 'italic',
                      marginBottom: '8px',
                      lineHeight: 1.6,
                    }}>
                      {prefix && <span>{prefix}</span>}
                      <span style={{
                        display: 'inline-block',
                        minWidth: '60px',
                        borderBottom: '2px solid var(--clr-purple)',
                        margin: '0 4px',
                        color: fill ? 'var(--clr-purple)' : 'var(--clr-text-dim)',
                        fontStyle: 'normal',
                        fontWeight: fill ? 700 : 400,
                      }}>
                        {fill || '___'}
                      </span>
                      {suffix && <span>{suffix}</span>}
                    </div>

                    <input
                      id={`fill-${i}`}
                      className="input"
                      style={{
                        borderColor: isLie ? 'rgba(244,63,94,0.5)' : 'rgba(139,92,246,0.4)',
                        background: 'rgba(255,255,255,0.04)',
                        fontSize: '0.97rem',
                      }}
                      placeholder={lang === 'hi' ? 'yahan likho…' : 'type here…'}
                      maxLength={120}
                      value={fill}
                      onChange={e => updateFill(i, e.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  {/* Live preview */}
                  {fill.trim() && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 14px',
                      borderRadius: 'var(--r-sm)',
                      background: isLie ? 'rgba(244,63,94,0.07)' : 'rgba(45,212,191,0.07)',
                      border: `1px solid ${isLie ? 'rgba(244,63,94,0.2)' : 'rgba(45,212,191,0.2)'}`,
                      fontSize: '0.9rem',
                      color: 'var(--clr-text)',
                      lineHeight: 1.5,
                    }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isLie ? 'var(--clr-red)' : 'var(--clr-teal)', marginRight: '6px' }}>
                        {lang === 'hi' ? 'Preview:' : 'Preview:'}
                      </span>
                      {preview}
                    </div>
                  )}

                  <div className="text-right text-xs text-muted" style={{ marginTop: '6px' }}>
                    {fill.length}/120
                  </div>
                </>
              )}
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
          disabled={
            selectedTemplates.some(t => !t) ||
            fills.some(f => !f.trim()) ||
            lieIndex === null
          }
        >
          {lang === 'hi' ? 'Submit Karo 🚀' : 'Submit Statements 🚀'}
        </button>
      </form>
    </div>
  );
}
