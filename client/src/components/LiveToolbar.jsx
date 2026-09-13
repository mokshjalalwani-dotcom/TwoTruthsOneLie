import { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'peerjs';

/* ═══════════════════════════════════════════════════════════════
   Inline SVG icons — clean, no emoji, consistent 
   ═══════════════════════════════════════════════════════════════ */

const ICON = {
  chat: (sz = 18, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  video: (sz = 18, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  mic: (sz = 16, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  micOff: (sz = 16, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  cam: (sz = 16, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  camOff: (sz = 16, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
    </svg>
  ),
  phoneOff: (sz = 16, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  ),
  send: (sz = 16, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  x: (sz = 14, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  users: (sz = 14, color = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};


/* ═══════════════════════════════════════════════════════════════
   LiveToolbar — unified floating panel with Chat + Video tabs
   ═══════════════════════════════════════════════════════════════ */

export default function LiveToolbar({
  playerId,
  players = [],
  peerIds = [],
  messages = [],
  onSend,
  onCallReady,
  onCallLeave,
}) {
  const [activeTab, setActiveTab] = useState(null);
  const [unread, setUnread]       = useState(0);
  const prevMsgCount              = useRef(messages.length);

  useEffect(() => {
    if (activeTab === 'chat') {
      setUnread(0);
      prevMsgCount.current = messages.length;
    } else {
      const diff = messages.length - prevMsgCount.current;
      if (diff > 0) setUnread(u => u + diff);
      prevMsgCount.current = messages.length;
    }
  }, [messages.length, activeTab]);

  function openTab(tab) {
    setActiveTab(prev => (prev === tab ? null : tab));
    if (tab === 'chat') setUnread(0);
  }

  const nickname = players.find(p => p.id === playerId)?.nickname ?? 'Me';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px',
        pointerEvents: 'none',
      }}
    >
      {/* Panel */}
      {activeTab && (
        <div
          className="animate-scale-in"
          style={{
            pointerEvents: 'all',
            width: 'min(380px, calc(100vw - 24px))',
            background: 'rgba(14,14,30,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
            backdropFilter: 'blur(24px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.025)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <TabButton
              active={activeTab === 'chat'}
              onClick={() => setActiveTab('chat')}
              icon={ICON.chat(15)}
              label="Chat"
              badge={activeTab !== 'chat' ? unread : 0}
            />
            <TabButton
              active={activeTab === 'video'}
              onClick={() => setActiveTab('video')}
              icon={ICON.video(15)}
              label="Video"
            />
            <button
              onClick={() => setActiveTab(null)}
              aria-label="Close panel"
              style={{
                padding: '0 14px',
                background: 'transparent',
                border: 'none',
                color: 'var(--clr-text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--clr-text)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-dim)'; }}
            >
              {ICON.x(13)}
            </button>
          </div>

          {activeTab === 'chat' && (
            <ChatPanel messages={messages} onSend={onSend} myPlayerId={playerId} />
          )}
          {activeTab === 'video' && (
            <VideoPanel
              playerId={playerId}
              myNickname={nickname}
              players={players}
              peerIds={peerIds}
              onCallReady={onCallReady}
              onCallLeave={onCallLeave}
            />
          )}
        </div>
      )}

      {/* FAB row */}
      <div style={{ display: 'flex', gap: '10px', pointerEvents: 'all' }}>
        <Fab
          id="btn-chat-fab"
          title="Chat"
          active={activeTab === 'chat'}
          onClick={() => openTab('chat')}
          icon={ICON.chat(20)}
          accentColor="139,92,246"
          badge={unread}
        />
        <Fab
          id="btn-video-fab"
          title="Video"
          active={activeTab === 'video'}
          onClick={() => openTab('video')}
          icon={ICON.video(20)}
          accentColor="45,212,191"
        />
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Tab Button
   ═══════════════════════════════════════════════════════════════ */

function TabButton({ active, onClick, icon, label, badge = 0 }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px 8px',
        background: active ? 'rgba(139,92,246,0.1)' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--clr-purple)' : '2px solid transparent',
        color: active ? 'var(--clr-text)' : 'var(--clr-text-muted)',
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: '0.82rem',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        letterSpacing: '0.01em',
      }}
    >
      {icon}
      {label}
      {badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '5px',
            right: '16px',
            background: 'var(--clr-red)',
            color: '#fff',
            fontSize: '0.58rem',
            fontWeight: 800,
            borderRadius: '999px',
            padding: '1px 5px',
            minWidth: '15px',
            textAlign: 'center',
            lineHeight: '14px',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════════
   FAB
   ═══════════════════════════════════════════════════════════════ */

function Fab({ id, title, active, onClick, icon, accentColor, badge = 0 }) {
  return (
    <button
      id={id}
      onClick={onClick}
      title={title}
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '14px',
        background: active
          ? `linear-gradient(135deg, rgba(${accentColor},0.85), rgba(${accentColor},0.55))`
          : `rgba(${accentColor},0.1)`,
        border: `1px solid rgba(${accentColor}, ${active ? 0.7 : 0.25})`,
        color: active ? '#fff' : `rgba(${accentColor}, 0.9)`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: active
          ? `0 4px 20px rgba(${accentColor},0.35)`
          : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = `rgba(${accentColor},0.2)`;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = `rgba(${accentColor},0.1)`;
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {icon}
      {badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: 'var(--clr-red)',
            color: '#fff',
            fontSize: '0.58rem',
            fontWeight: 800,
            borderRadius: '999px',
            padding: '2px 5px',
            minWidth: '16px',
            textAlign: 'center',
            lineHeight: '13px',
            boxShadow: '0 2px 6px rgba(244,63,94,0.4)',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Chat Panel
   ═══════════════════════════════════════════════════════════════ */

function ChatPanel({ messages, onSend, myPlayerId }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '320px' }}>
      <div
        className="chat-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--clr-text-dim)', fontSize: '0.84rem',
              textAlign: 'center', gap: '10px',
            }}
          >
            <div style={{ opacity: 0.4 }}>{ICON.chat(32)}</div>
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
                  gap: '7px',
                }}
              >
                <div
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: isMe ? 'var(--grad-brand)' : 'rgba(139,92,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 900, color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {(msg.nickname || '?')[0].toUpperCase()}
                </div>
                <div
                  style={{
                    maxWidth: '72%', display: 'flex', flexDirection: 'column',
                    gap: '2px', alignItems: isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                  {!isMe && (
                    <span style={{ fontSize: '0.66rem', color: 'var(--clr-text-dim)', fontWeight: 700 }}>
                      {msg.nickname}
                    </span>
                  )}
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isMe
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.55), rgba(45,212,191,0.35))'
                        : 'rgba(255,255,255,0.06)',
                      border: isMe ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      fontSize: '0.86rem',
                      color: 'var(--clr-text)',
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '0.58rem', color: 'var(--clr-text-dim)' }}>
                    {fmt(msg.ts)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex', gap: '8px',
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        <input
          id="chat-input"
          className="input"
          style={{
            flex: 1, padding: '9px 14px', fontSize: '0.86rem',
            borderRadius: 'var(--r-full)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          placeholder="Type a message..."
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={200}
          autoComplete="off"
        />
        <button
          id="btn-chat-send"
          type="submit"
          disabled={!text.trim()}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: text.trim() ? 'var(--grad-brand)' : 'rgba(255,255,255,0.05)',
            border: 'none',
            color: text.trim() ? '#fff' : 'var(--clr-text-dim)',
            cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {ICON.send(14, text.trim() ? '#fff' : 'var(--clr-text-dim)')}
        </button>
      </form>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Video Panel — PeerJS
   ═══════════════════════════════════════════════════════════════ */

function VideoPanel({ playerId, myNickname, players, peerIds, onCallReady, onCallLeave }) {
  const [inCall, setInCall]     = useState(false);
  const [streams, setStreams]   = useState({});
  const [myStream, setMyStream] = useState(null);
  const [camError, setCamError] = useState('');
  const [muted, setMuted]       = useState(false);
  const [camOff, setCamOff]     = useState(false);

  const peerRef    = useRef(null);
  const myVideoRef = useRef(null);
  const callsRef   = useRef({});

  const getNickname = useCallback(
    (pid) => players.find(p => p.id === pid)?.nickname ?? pid.slice(0, 8),
    [players]
  );

  useEffect(() => {
    if (myVideoRef.current && myStream) {
      myVideoRef.current.srcObject = myStream;
    }
  }, [myStream, inCall]);

  useEffect(() => {
    if (!inCall || !peerRef.current || !myStream) return;
    peerIds.forEach(pid => {
      if (pid === playerId) return;
      if (callsRef.current[pid]) return;
      _callPeer(pid);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerIds, inCall]);

  function _addStream(peerId, stream) {
    setStreams(prev => ({ ...prev, [peerId]: stream }));
  }
  function _removeStream(peerId) {
    setStreams(prev => { const n = { ...prev }; delete n[peerId]; return n; });
    delete callsRef.current[peerId];
  }
  function _callPeer(peerId) {
    if (!peerRef.current || !myStream) return;
    const call = peerRef.current.call(peerId, myStream);
    callsRef.current[peerId] = call;
    call.on('stream', (rs) => _addStream(peerId, rs));
    call.on('close', () => _removeStream(peerId));
    call.on('error', () => _removeStream(peerId));
  }

  async function startCall() {
    if (!playerId) return;
    setCamError('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      setCamError('Camera or microphone access was denied. Please allow it in your browser settings.');
      return;
    }
    setMyStream(stream);
    setMuted(false);
    setCamOff(false);

    const safePeerId = playerId.replace(/[^a-zA-Z0-9-]/g, '-');
    const peer = new Peer(safePeerId, {
      host: '0.peerjs.com', port: 443, secure: true, path: '/',
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });
    peerRef.current = peer;

    peer.on('open', () => { setInCall(true); onCallReady(); });
    peer.on('call', (call) => {
      call.answer(stream);
      call.on('stream', (rs) => _addStream(call.peer, rs));
      call.on('close', () => _removeStream(call.peer));
      callsRef.current[call.peer] = call;
    });
    peer.on('error', (err) => console.error('[PeerJS]', err));
  }

  function leaveCall() {
    Object.values(callsRef.current).forEach(c => c.close());
    callsRef.current = {};
    myStream?.getTracks().forEach(t => t.stop());
    setMyStream(null);
    setStreams({});
    setInCall(false);
    peerRef.current?.destroy();
    peerRef.current = null;
    onCallLeave();
  }

  function toggleMute() {
    if (!myStream) return;
    myStream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }
  function toggleCam() {
    if (!myStream) return;
    myStream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  }

  const remotePeerIds = peerIds.filter(pid => pid !== playerId);
  const totalInCall   = inCall ? remotePeerIds.length + 1 : 0;

  // Compact tile height: auto-shrink as more people join so everything fits
  const tileHeight = totalInCall <= 2 ? 120 : totalInCall <= 4 ? 100 : 80;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Error */}
      {camError && (
        <div style={{
          margin: '10px 12px 0', padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(244,63,94,0.08)',
          border: '1px solid rgba(244,63,94,0.25)',
          color: 'var(--clr-red)', fontSize: '0.78rem', lineHeight: 1.4,
        }}>
          {camError}
        </div>
      )}

      {/* In-call: video grid + controls */}
      {inCall && (
        <>
          {/* Video grid — always 2 columns, compact fixed-height tiles, no scrolling */}
          <div style={{
            padding: '10px',
            display: 'grid',
            gridTemplateColumns: totalInCall === 1 ? '1fr' : '1fr 1fr',
            gap: '6px',
          }}>
            {/* My tile */}
            <div style={{
              position: 'relative',
              borderRadius: '10px',
              overflow: 'hidden',
              background: '#111',
              height: `${tileHeight}px`,
              border: '1.5px solid rgba(45,212,191,0.35)',
            }}>
              {camOff ? (
                <CamOffPlaceholder name={myNickname} />
              ) : (
                <video
                  ref={myVideoRef}
                  autoPlay muted playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              <TileLabel name="You" isMe />
            </div>

            {/* Remote tiles */}
            {remotePeerIds.map(pid => (
              <RemoteTile
                key={pid}
                stream={streams[pid]}
                name={getNickname(pid)}
                height={tileHeight}
              />
            ))}
          </div>

          {/* Control bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '6px 12px 12px',
          }}>
            {/* Status text */}
            <div style={{
              flex: 1,
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.75rem', color: 'var(--clr-text-muted)',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 6px rgba(34,197,94,0.6)',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                {totalInCall} in call
              </span>
            </div>

            {/* Mic toggle */}
            <ControlBtn
              id="btn-toggle-mute"
              title={muted ? 'Unmute' : 'Mute'}
              onClick={toggleMute}
              active={muted}
              icon={muted ? ICON.micOff(15) : ICON.mic(15)}
            />
            {/* Cam toggle */}
            <ControlBtn
              id="btn-toggle-cam"
              title={camOff ? 'Camera on' : 'Camera off'}
              onClick={toggleCam}
              active={camOff}
              icon={camOff ? ICON.camOff(15) : ICON.cam(15)}
            />
            {/* Leave */}
            <button
              id="btn-leave-call"
              title="Leave call"
              onClick={leaveCall}
              style={{
                width: '36px', height: '30px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.1s',
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {ICON.phoneOff(14)}
            </button>
          </div>
        </>
      )}

      {/* Not in call: join prompt */}
      {!inCall && (
        <div style={{
          padding: '28px 20px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '14px',
          textAlign: 'center',
        }}>
          {/* Camera icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(45,212,191,0.08)',
            border: '1px solid rgba(45,212,191,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--clr-teal)',
          }}>
            {ICON.video(22)}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--clr-text)', marginBottom: '4px' }}>
              Start a video call
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-dim)', lineHeight: 1.4 }}>
              See and talk to other players while you play
            </p>
          </div>
          <button
            id="btn-start-call"
            onClick={startCall}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 24px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(45,212,191,0.85), rgba(16,185,129,0.85))',
              border: 'none',
              color: '#fff',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(45,212,191,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(45,212,191,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(45,212,191,0.3)';
            }}
          >
            {ICON.video(16, '#fff')}
            Join call
          </button>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Shared Sub-Components
   ═══════════════════════════════════════════════════════════════ */

function ControlBtn({ id, title, onClick, active, icon }) {
  return (
    <button
      id={id}
      title={title}
      onClick={onClick}
      style={{
        width: '32px', height: '30px',
        borderRadius: '8px',
        background: active ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${active ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
        color: active ? '#f87171' : 'var(--clr-text-muted)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
      }}
    >
      {icon}
    </button>
  );
}

function CamOffPlaceholder({ name }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.03)',
      gap: '4px',
    }}>
      {/* Avatar circle */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        background: 'var(--grad-brand)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.85rem', fontWeight: 800, color: '#fff',
      }}>
        {(name || '?')[0].toUpperCase()}
      </div>
      <span style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)' }}>Camera off</span>
    </div>
  );
}

function RemoteTile({ stream, name, height }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{
      position: 'relative',
      borderRadius: '10px',
      overflow: 'hidden',
      background: '#111',
      height: `${height}px`,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.02)',
          gap: '6px',
        }}>
          {/* Avatar circle while connecting */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 800, color: '#fff',
          }}>
            {(name || '?')[0].toUpperCase()}
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)' }}>Connecting...</span>
        </div>
      )}
      <TileLabel name={name} />
    </div>
  );
}

function TileLabel({ name, isMe }) {
  return (
    <span style={{
      position: 'absolute',
      bottom: '5px',
      left: '5px',
      background: isMe ? 'rgba(45,212,191,0.7)' : 'rgba(0,0,0,0.55)',
      borderRadius: '5px',
      padding: '1px 7px',
      fontSize: '0.65rem',
      color: '#fff',
      fontWeight: 700,
      maxWidth: 'calc(100% - 10px)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      backdropFilter: 'blur(4px)',
    }}>
      {name}
    </span>
  );
}
