import { useState, useEffect } from 'react';
import Countdown from './Countdown.jsx';


/**
 * Shown to:
 *  - Non-subject players during writing phase (with GroupChat embedded)
 *  - The subject player during voting phase (isSubjectWaiting=true, with GroupChat embedded)
 */
export default function Waiting({ gs, isSubjectWaiting = false }) {
  const { subjectNickname, deadline, round, maxRounds, category, typingInfo } = gs;

  // After 4 s of no typing events, fall back to a generic message
  const [typingStale, setTypingStale] = useState(false);
  useEffect(() => {
    if (!typingInfo) return;
    setTypingStale(false);
    const t = setTimeout(() => setTypingStale(true), 4000);
    return () => clearTimeout(t);
  }, [typingInfo]);

  const message = isSubjectWaiting
    ? 'Players are voting on your statements…'
    : `Waiting for ${subjectNickname ?? 'the Subject'} to write their statements…`;

  const emoji = isSubjectWaiting ? '🗳️' : '✍️';

  return (
    <div
      className="animate-fade-in"
      style={{
        maxWidth: '520px',
        margin: '0 auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Top section — centred */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
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

        {/* Live typing indicator */}
        {!isSubjectWaiting && (
          <div style={{
            minHeight: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
            color: 'var(--clr-text-muted)',
            fontStyle: 'italic',
          }}>
            {typingInfo ? (
              <>
                <span style={{ color: 'var(--clr-purple)', fontStyle: 'normal', fontWeight: 700 }}>✍️</span>
                {typingStale
                  ? `${typingInfo.nickname} is still writing…`
                  : `${typingInfo.nickname} is filling in statement ${typingInfo.fieldIndex + 1}…`
                }
                <span style={{ display: 'inline-flex', gap: '3px', marginLeft: '2px' }}>
                  {[0, 1, 2].map(k => (
                    <span
                      key={k}
                      style={{
                        width: '5px', height: '5px',
                        borderRadius: '50%',
                        background: 'var(--clr-purple)',
                        display: 'inline-block',
                        animation: `pulse-urgent 0.7s ease-in-out ${k * 0.18}s infinite alternate`,
                      }}
                    />
                  ))}
                </span>
              </>
            ) : (
              <span style={{ opacity: 0.5 }}>waiting for {subjectNickname ?? 'Subject'} to start typing…</span>
            )}
          </div>
        )}

        {/* Category hint */}
        {!isSubjectWaiting && category && (
          <div className="animate-scale-in" style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 18px',
            borderRadius: 'var(--r-full)',
            background: 'rgba(45,212,191,0.08)',
            border: '1px solid rgba(45,212,191,0.25)',
          }}>
            <span style={{ fontSize: '1rem' }}>💡</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--clr-text-muted)' }}>
              Writing about:{' '}
              <strong style={{ color: 'var(--clr-teal)', fontWeight: 800 }}>{category}</strong>
            </span>
          </div>
        )}

        {/* Countdown */}
        <div className="card" style={{ padding: '16px 40px', textAlign: 'center' }}>
          <Countdown deadline={deadline} />
          <p className="text-muted text-sm" style={{ marginTop: '6px' }}>seconds remaining</p>
        </div>

        {/* Pulsing dots */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[0, 1, 2].map(i => (
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

      {/* Hint that chat is available in the bottom-right toolbar */}
      <div style={{
        textAlign: 'center',
        color: 'var(--clr-text-dim)',
        fontSize: '0.82rem',
        marginTop: '8px',
      }}>
        💬 Use the chat in the bottom-right corner to talk with your team!
      </div>
    </div>
  );
}
