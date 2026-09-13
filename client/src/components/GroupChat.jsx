import { useState, useRef, useEffect } from 'react';

/**
 * GroupChat — real-time chat panel for waiting players.
 * Props:
 *   messages      : { playerId, nickname, text, ts }[]
 *   onSend        : (text: string) => void
 *   myPlayerId    : string
 *   floating?     : boolean  — shows as a small floating widget (for the Writing subject)
 */
export default function GroupChat({ messages, onSend, myPlayerId, floating = false }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(!floating);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  function fmt(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ─── Floating variant (shown to the subject during writing phase) ──
  if (floating) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
      }}>
        {/* Chat panel */}
        {open && (
          <div className="animate-scale-in" style={{
            width: 'min(320px, calc(100vw - 40px))',
            background: 'rgba(18,18,42,0.96)',
            border: '1px solid rgba(139,92,246,0.35)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <ChatHeader onClose={() => setOpen(false)} count={messages.length} />
            <MessageList messages={messages} myPlayerId={myPlayerId} bottomRef={bottomRef} fmt={fmt} compact />
            <ChatInput text={text} setText={setText} onSend={handleSend} />
          </div>
        )}

        {/* Bubble toggle */}
        <button
          id="btn-chat-toggle-float"
          onClick={() => setOpen(o => !o)}
          style={{
            width: '52px', height: '52px',
            borderRadius: '50%',
            background: 'var(--grad-brand)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.4rem',
            boxShadow: '0 4px 20px rgba(139,92,246,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          💬
          {messages.length > 0 && !open && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: 'var(--clr-red)',
              color: '#fff', fontSize: '0.65rem', fontWeight: 900,
              borderRadius: '999px', padding: '2px 6px',
              minWidth: '18px', textAlign: 'center',
            }}>
              {messages.length > 99 ? '99+' : messages.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  // ─── Embedded variant (shown to waiting players) ────────────────
  return (
    <div style={{
      marginTop: '24px',
      background: 'rgba(18,18,42,0.75)',
      border: '1px solid rgba(139,92,246,0.25)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      backdropFilter: 'blur(16px)',
    }}>
      <ChatHeader showEmoji count={messages.length} />
      <MessageList messages={messages} myPlayerId={myPlayerId} bottomRef={bottomRef} fmt={fmt} />
      <ChatInput text={text} setText={setText} onSend={handleSend} />
    </div>
  );
}

function ChatHeader({ onClose, showEmoji, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid rgba(139,92,246,0.15)',
      background: 'rgba(139,92,246,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.1rem' }}>💬</span>
        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--clr-text)' }}>
          Group Chat
        </span>
        {count > 0 && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700,
            background: 'rgba(139,92,246,0.2)',
            color: 'var(--clr-purple)',
            borderRadius: '999px', padding: '2px 8px',
          }}>
            {count}
          </span>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--clr-text-muted)', fontSize: '1rem', lineHeight: 1,
            padding: '2px',
          }}
        >✕</button>
      )}
    </div>
  );
}

function MessageList({ messages, myPlayerId, bottomRef, fmt, compact }) {
  return (
    <div style={{
      height: compact ? '200px' : '280px',
      overflowY: 'auto',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {messages.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--clr-text-dim)', fontSize: '0.85rem', textAlign: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '2rem' }}>👋</span>
          <span>No messages yet — say hi!</span>
        </div>
      ) : (
        messages.map((msg, i) => {
          const isMe = msg.playerId === myPlayerId;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: isMe ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: '8px',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: isMe ? 'var(--grad-brand)' : 'rgba(139,92,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 900, color: '#fff',
                flexShrink: 0,
              }}>
                {msg.nickname[0].toUpperCase()}
              </div>

              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!isMe && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)', fontWeight: 700, marginBottom: '1px' }}>
                    {msg.nickname}
                  </span>
                )}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMe
                    ? 'linear-gradient(135deg, rgba(139,92,246,0.6), rgba(45,212,191,0.4))'
                    : 'rgba(255,255,255,0.06)',
                  border: isMe ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  fontSize: '0.88rem',
                  color: 'var(--clr-text)',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}>
                  {msg.text}
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--clr-text-dim)', marginTop: '1px' }}>
                  {fmt(msg.ts)}
                </span>
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function ChatInput({ text, setText, onSend }) {
  return (
    <form
      onSubmit={onSend}
      style={{
        display: 'flex', gap: '8px',
        padding: '12px 16px',
        borderTop: '1px solid rgba(139,92,246,0.15)',
        background: 'rgba(10,10,24,0.5)',
      }}
    >
      <input
        id="chat-input"
        className="input"
        style={{
          flex: 1,
          padding: '8px 14px',
          fontSize: '0.9rem',
          borderRadius: 'var(--r-full)',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(139,92,246,0.3)',
        }}
        placeholder="Say something…"
        value={text}
        onChange={e => setText(e.target.value)}
        maxLength={200}
        autoComplete="off"
      />
      <button
        id="btn-chat-send"
        type="submit"
        className="btn btn--primary btn--sm"
        style={{ borderRadius: 'var(--r-full)', padding: '8px 16px', flexShrink: 0 }}
        disabled={!text.trim()}
      >
        ➤
      </button>
    </form>
  );
}
