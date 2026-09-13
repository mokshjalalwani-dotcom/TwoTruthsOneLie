import { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'peerjs';

/**
 * LiveToolbar — unified floating bottom-right panel with Chat + Video tabs.
 *
 * Props:
 *   playerId     : string   — our socket/player ID
 *   players      : { id, nickname }[]  — all players in the room
 *   peerIds      : string[] — peer IDs currently in video call
 *   messages     : { playerId, nickname, text, ts }[]
 *   onSend       : (text) => void
 *   onCallReady  : () => void
 *   onCallLeave  : () => void
 *   unreadCount  : number   — unread chat messages badge (managed externally)
 */
export default function LiveToolbar({
  playerId,
  players = [],
  peerIds = [],
  messages = [],
  onSend,
  onCallReady,
  onCallLeave,
}) {
  const [activeTab, setActiveTab] = useState(null); // null | 'chat' | 'video'
  const [unread, setUnread]       = useState(0);
  const prevMsgCount              = useRef(messages.length);

  // Track unread messages when chat is closed
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
        bottom: '20px',
        right: '20px',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        // ensure pointer events only on actual elements
        pointerEvents: 'none',
      }}
    >
      {/* ─── Expanded panel ─── */}
      {activeTab && (
        <div
          className="animate-scale-in"
          style={{
            pointerEvents: 'all',
            width: 'min(360px, calc(100vw - 24px))',
            background: 'rgba(10,10,24,0.97)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 16px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.08)',
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
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            {[
              { id: 'chat',  label: '💬 Chat',  badge: unread },
              { id: 'video', label: '📹 Video', badge: 0 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '11px 8px',
                  background: activeTab === tab.id
                    ? 'rgba(139,92,246,0.12)'
                    : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id
                    ? '2px solid var(--clr-purple)'
                    : '2px solid transparent',
                  color: activeTab === tab.id
                    ? 'var(--clr-text)'
                    : 'var(--clr-text-muted)',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                  position: 'relative',
                }}
              >
                {tab.label}
                {tab.badge > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '18px',
                      background: 'var(--clr-red)',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: 900,
                      borderRadius: '999px',
                      padding: '1px 5px',
                      minWidth: '16px',
                      textAlign: 'center',
                    }}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setActiveTab(null)}
              style={{
                padding: '11px 14px',
                background: 'transparent',
                border: 'none',
                color: 'var(--clr-text-muted)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--clr-text)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
            >
              ✕
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'chat' && (
            <ChatPanel
              messages={messages}
              onSend={onSend}
              myPlayerId={playerId}
            />
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

      {/* ─── FAB button row ─── */}
      <div style={{ display: 'flex', gap: '10px', pointerEvents: 'all' }}>
        <ChatFab
          active={activeTab === 'chat'}
          unread={unread}
          onClick={() => openTab('chat')}
        />
        <VideoFab
          active={activeTab === 'video'}
          onClick={() => openTab('video')}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   FAB Buttons
═══════════════════════════════════════════════════ */

function ChatFab({ active, unread, onClick }) {
  return (
    <button
      id="btn-chat-fab"
      onClick={onClick}
      title="Group Chat"
      style={{
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: active
          ? 'var(--grad-brand)'
          : 'rgba(139,92,246,0.15)',
        border: `1px solid ${active ? 'rgba(139,92,246,0.8)' : 'rgba(139,92,246,0.3)'}`,
        color: active ? '#fff' : 'var(--clr-purple)',
        fontSize: '1.3rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: active ? '0 0 20px rgba(139,92,246,0.45)' : 'none',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(139,92,246,0.25)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; }}
    >
      💬
      {unread > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: 'var(--clr-red)',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 900,
            borderRadius: '999px',
            padding: '2px 5px',
            minWidth: '16px',
            textAlign: 'center',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function VideoFab({ active, onClick }) {
  return (
    <button
      id="btn-video-fab"
      onClick={onClick}
      title="Video Call"
      style={{
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: active
          ? 'linear-gradient(135deg, #10b981, #2dd4bf)'
          : 'rgba(45,212,191,0.12)',
        border: `1px solid ${active ? 'rgba(45,212,191,0.8)' : 'rgba(45,212,191,0.3)'}`,
        color: active ? '#fff' : 'var(--clr-teal)',
        fontSize: '1.3rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: active ? '0 0 20px rgba(45,212,191,0.4)' : 'none',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(45,212,191,0.22)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(45,212,191,0.12)'; }}
    >
      📹
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   Chat Panel (tab content)
═══════════════════════════════════════════════════ */

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
      {/* Messages */}
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
              color: 'var(--clr-text-dim)', fontSize: '0.85rem',
              textAlign: 'center', gap: '8px',
            }}
          >
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
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.65), rgba(45,212,191,0.45))'
                        : 'rgba(255,255,255,0.06)',
                      border: isMe ? 'none' : '1px solid rgba(255,255,255,0.07)',
                      fontSize: '0.87rem',
                      color: 'var(--clr-text)',
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--clr-text-dim)' }}>
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
          background: 'rgba(0,0,0,0.25)',
        }}
      >
        <input
          id="chat-input"
          className="input"
          style={{
            flex: 1, padding: '8px 14px', fontSize: '0.88rem',
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
          style={{ borderRadius: 'var(--r-full)', padding: '8px 14px', flexShrink: 0 }}
          disabled={!text.trim()}
        >
          ➤
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Video Panel (tab content) — PeerJS
═══════════════════════════════════════════════════ */

function VideoPanel({ playerId, myNickname, players, peerIds, onCallReady, onCallLeave }) {
  const [inCall, setInCall]     = useState(false);
  const [streams, setStreams]   = useState({});   // peerId → MediaStream
  const [myStream, setMyStream] = useState(null);
  const [camError, setCamError] = useState('');
  const [muted, setMuted]       = useState(false);
  const [camOff, setCamOff]     = useState(false);

  const peerRef    = useRef(null);
  const myVideoRef = useRef(null);
  const callsRef   = useRef({});

  // Nickname lookup helper
  const getNickname = useCallback(
    (pid) => players.find(p => p.id === pid)?.nickname ?? pid.slice(0, 8) + '…',
    [players]
  );

  // Local video feed
  useEffect(() => {
    if (myVideoRef.current && myStream) {
      myVideoRef.current.srcObject = myStream;
    }
  }, [myStream]);

  // Call any new peer that joined after we're already in call
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
    setStreams(prev => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    delete callsRef.current[peerId];
  }

  function _callPeer(peerId) {
    if (!peerRef.current || !myStream) return;
    const call = peerRef.current.call(peerId, myStream);
    callsRef.current[peerId] = call;
    call.on('stream', (remoteStream) => _addStream(peerId, remoteStream));
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
      setCamError('Camera/mic permission denied. Please allow access and try again.');
      return;
    }

    setMyStream(stream);
    setMuted(false);
    setCamOff(false);

    const safePeerId = playerId.replace(/[^a-zA-Z0-9-]/g, '-');
    const peer = new Peer(safePeerId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      path: '/',
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });
    peerRef.current = peer;

    peer.on('open', () => {
      setInCall(true);
      onCallReady();
    });

    peer.on('call', (call) => {
      call.answer(stream);
      call.on('stream', (remoteStream) => _addStream(call.peer, remoteStream));
      call.on('close', () => _removeStream(call.peer));
      callsRef.current[call.peer] = call;
    });

    peer.on('error', (err) => {
      console.error('[PeerJS]', err);
    });
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

  // Grid layout: 1 col for ≤2 participants, 2 cols for 3+
  const gridCols = (inCall ? remotePeerIds.length + 1 : 0) >= 3 ? 2 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Status bar */}
      <div
        style={{
          padding: '8px 14px',
          background: inCall
            ? 'rgba(16,185,129,0.08)'
            : 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--clr-text-muted)' }}>
          {inCall ? (
            <>
              <span
                style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: 'var(--clr-green)',
                  boxShadow: '0 0 6px var(--clr-green)',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--clr-green)', fontWeight: 700 }}>
                Live · {totalInCall} {totalInCall === 1 ? 'person' : 'people'}
              </span>
            </>
          ) : (
            <>
              <span style={{ opacity: 0.5 }}>⚫</span>
              <span>Not in call</span>
            </>
          )}
        </div>
        {/* In-call controls */}
        {inCall && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <ControlBtn
              id="btn-toggle-mute"
              title={muted ? 'Unmute' : 'Mute'}
              onClick={toggleMute}
              active={muted}
              icon={muted ? '🔇' : '🎙️'}
            />
            <ControlBtn
              id="btn-toggle-cam"
              title={camOff ? 'Turn camera on' : 'Turn camera off'}
              onClick={toggleCam}
              active={camOff}
              icon={camOff ? '🚫' : '📷'}
            />
          </div>
        )}
      </div>

      {/* Error */}
      {camError && (
        <div
          style={{
            margin: '10px 12px 0',
            padding: '10px 14px',
            borderRadius: 'var(--r-sm)',
            background: 'rgba(244,63,94,0.1)',
            border: '1px solid rgba(244,63,94,0.3)',
            color: 'var(--clr-red)',
            fontSize: '0.8rem',
          }}
        >
          {camError}
        </div>
      )}

      {/* Video grid */}
      {inCall && (
        <div
          style={{
            padding: '10px 10px 4px',
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: '8px',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
          className="chat-scroll"
        >
          {/* My video tile */}
          <VideoTile
            label={myNickname + ' (You)'}
            isMe
            stream={myStream}
            videoRef={myVideoRef}
            muted
            camOff={camOff}
          />

          {/* Remote tiles */}
          {remotePeerIds.map(pid => (
            <RemoteTile
              key={pid}
              peerId={pid}
              stream={streams[pid]}
              label={getNickname(pid)}
            />
          ))}
        </div>
      )}

      {/* Waiting state */}
      {inCall && remotePeerIds.length === 0 && (
        <div
          style={{
            padding: '12px 16px',
            textAlign: 'center',
            color: 'var(--clr-text-dim)',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>👀</div>
          Waiting for others to join…
        </div>
      )}

      {/* Action button */}
      <div style={{ padding: '10px 12px 12px' }}>
        {!inCall ? (
          <button
            id="btn-start-call"
            className="btn btn--primary btn--full btn--sm"
            style={{ borderRadius: 'var(--r-md)' }}
            onClick={startCall}
          >
            📹 Join Video Call
          </button>
        ) : (
          <button
            id="btn-leave-call"
            className="btn btn--danger btn--full btn--sm"
            style={{ borderRadius: 'var(--r-md)' }}
            onClick={leaveCall}
          >
            📵 Leave Call
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Small control button (mute / cam) ─────────────── */
function ControlBtn({ id, title, onClick, active, icon }) {
  return (
    <button
      id={id}
      title={title}
      onClick={onClick}
      style={{
        width: '28px', height: '28px',
        borderRadius: '50%',
        background: active ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.08)',
        border: `1px solid ${active ? 'rgba(244,63,94,0.5)' : 'rgba(255,255,255,0.12)'}`,
        color: 'var(--clr-text)',
        fontSize: '0.8rem',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {icon}
    </button>
  );
}

/* ─── My video tile ──────────────────────────────────── */
function VideoTile({ label, stream, videoRef, muted: mutedProp, camOff }) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        background: '#000',
        aspectRatio: '4/3',
        border: '2px solid rgba(45,212,191,0.4)',
      }}
    >
      {camOff ? (
        <div
          style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--clr-text-dim)', fontSize: '0.78rem', gap: '6px',
          }}
        >
          <span style={{ fontSize: '1.6rem' }}>🚫</span>
          Camera off
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted={mutedProp}
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      <TileLabel label={label} isMe />
    </div>
  );
}

/* ─── Remote video tile ──────────────────────────────── */
function RemoteTile({ peerId, stream, label }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        background: '#000',
        aspectRatio: '4/3',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--clr-text-dim)', fontSize: '0.76rem', gap: '6px',
          }}
        >
          <span
            style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--clr-amber)',
              animation: 'pulse-urgent 1s ease-in-out infinite alternate',
              display: 'inline-block',
            }}
          />
          Connecting…
        </div>
      )}
      <TileLabel label={label} />
    </div>
  );
}

/* ─── Tile name label ────────────────────────────────── */
function TileLabel({ label, isMe }) {
  return (
    <span
      style={{
        position: 'absolute',
        bottom: '6px',
        left: '6px',
        background: isMe ? 'rgba(45,212,191,0.75)' : 'rgba(0,0,0,0.6)',
        borderRadius: '6px',
        padding: '2px 8px',
        fontSize: '0.68rem',
        color: '#fff',
        fontWeight: 700,
        maxWidth: 'calc(100% - 12px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
