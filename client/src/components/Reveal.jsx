import { useEffect, useState, useRef } from 'react';
import socket from '../socket.js';

const LABELS = ['A', 'B', 'C'];
const REACTION_EMOJIS = ['👀', '🤯', '😂', '😱', '🫡'];
const REACTION_WINDOW_MS = 5000;
const REACTION_DEBOUNCE_MS = 500;
const REACTION_LIFETIME_MS = 1600;

export default function Reveal({ gs, actions, isHost, isSubject }) {
  const { revealData, players, round, maxRounds } = gs;
  const { statements, shuffledLieIndex, votes, scoreDelta } = revealData ?? {};

  // ── Score delta animation ─────────────────────────────────────────────────
  const [visibleDeltas, setVisibleDeltas] = useState([]);

  useEffect(() => {
    if (!scoreDelta) return;
    setVisibleDeltas([]);
    const nonZero = Object.entries(scoreDelta).filter(([, pts]) => pts !== 0);
    nonZero.forEach(([pid, pts], i) => {
      setTimeout(() => {
        setVisibleDeltas(prev => [...prev, { pid, pts }]);
      }, 600 + i * 400);
    });
  }, [scoreDelta]);

  // ── Emoji reactions ───────────────────────────────────────────────────────
  const [reactionWindowOpen, setReactionWindowOpen] = useState(true);
  const [reactions, setReactions] = useState([]);  // { id, emoji, x }
  const lastReactionTap = useRef({});               // emoji → timestamp

  // Close the 5-second reaction window
  useEffect(() => {
    const t = setTimeout(() => setReactionWindowOpen(false), REACTION_WINDOW_MS);
    return () => clearTimeout(t);
  }, []);

  // Listen for reactions from other players
  useEffect(() => {
    const handler = ({ emoji }) => spawnReaction(emoji);
    socket.on('reaction-burst', handler);
    return () => socket.off('reaction-burst', handler);
  }, []);

  function spawnReaction(emoji) {
    const id = Date.now() + Math.random();
    const x  = 8 + Math.random() * 84; // 8–92% horizontal
    setReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, REACTION_LIFETIME_MS);
  }

  function handleReactionClick(emoji) {
    const now = Date.now();
    if (now - (lastReactionTap.current[emoji] ?? 0) < REACTION_DEBOUNCE_MS) return;
    lastReactionTap.current[emoji] = now;

    const roomCode = localStorage.getItem('tt_roomCode') || '';
    socket.emit('send-reaction', { roomCode, emoji });
    spawnReaction(emoji); // add locally (server sends to others only)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getNickname(pid) {
    return players?.find(p => p.id === pid)?.nickname ?? 'Unknown';
  }

  const isLastRound = round >= maxRounds;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 0', position: 'relative' }}>

      {/* Floating reaction burst overlay */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200 }}>
        {reactions.map(r => (
          <div
            key={r.id}
            style={{
              position: 'absolute',
              left: `${r.x}%`,
              bottom: '25%',
              fontSize: '2.4rem',
              animation: `reaction-float ${REACTION_LIFETIME_MS}ms ease-out forwards`,
              userSelect: 'none',
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

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

      {/* Emoji reaction buttons (5-second window) */}
      {reactionWindowOpen && (
        <div className="animate-fade-in" style={{ marginBottom: '20px' }}>
          <p className="text-xs text-muted" style={{ textAlign: 'center', marginBottom: '8px' }}>
            React!
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                id={`btn-react-${emoji}`}
                onClick={() => handleReactionClick(emoji)}
                style={{
                  fontSize: '1.8rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--r-md)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  transition: 'transform 0.1s, background 0.15s',
                  lineHeight: 1,
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.88)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Who voted for what (with confidence) */}
      {votes && Object.keys(votes).length > 0 && (
        <div className="card animate-slide-up" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Votes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(votes).map(([pid, vote]) => {
              const { voteIndex: votedIdx, confidence } = vote;
              const correct = votedIdx === shuffledLieIndex;
              return (
                <div key={pid} className="flex justify-between items-center" style={{ fontSize: '0.88rem' }}>
                  <span style={{ fontWeight: 600 }}>{getNickname(pid)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge--purple" style={{ fontSize: '0.68rem' }}>
                      {LABELS[votedIdx]}
                    </span>
                    <span
                      title={confidence === 'sure' ? 'Sure (+2/−1)' : 'Risky (+1/0)'}
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '999px',
                        background: confidence === 'sure' ? 'rgba(139,92,246,0.15)' : 'rgba(45,212,191,0.1)',
                        color: confidence === 'sure' ? 'var(--clr-purple)' : 'var(--clr-teal)',
                        fontWeight: 700,
                      }}
                    >
                      {confidence === 'sure' ? '🎯 Sure' : '🎲 Risky'}
                    </span>
                    <span style={{ color: correct ? 'var(--clr-green)' : 'var(--clr-red)', fontWeight: 700 }}>
                      {correct ? '✅' : '❌'}
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
            {visibleDeltas.map(({ pid, pts }) => (
              <div key={pid} className="flex justify-between items-center animate-slide-up" style={{ fontSize: '0.95rem' }}>
                <span style={{ fontWeight: 600 }}>{getNickname(pid)}</span>
                <span style={{
                  color: pts > 0 ? 'var(--clr-green)' : 'var(--clr-red)',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}>
                  {pts > 0 ? `+${pts}` : pts} pt{Math.abs(pts) !== 1 ? 's' : ''}
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
