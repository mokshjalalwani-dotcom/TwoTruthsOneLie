import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

/**
 * VideoCall — PeerJS in-app video panel.
 * Props:
 *   playerId    : string — our unique ID (used as Peer ID)
 *   peerIds     : string[] — everyone who is currently in the call
 *   onCallReady : () => void — emit call-ready to server
 *   onCallLeave : () => void — emit call-leave to server
 */
export default function VideoCall({ playerId, peerIds, onCallReady, onCallLeave }) {
  const [open, setOpen]         = useState(false);
  const [inCall, setInCall]     = useState(false);
  const [streams, setStreams]   = useState({}); // peerId → MediaStream
  const [myStream, setMyStream] = useState(null);
  const [camError, setCamError] = useState('');

  const peerRef    = useRef(null);
  const myVideoRef = useRef(null);
  const callsRef   = useRef({}); // peerId → MediaConnection

  // Set local video whenever myStream changes
  useEffect(() => {
    if (myVideoRef.current && myStream) {
      myVideoRef.current.srcObject = myStream;
    }
  }, [myStream]);

  // When peerIds list changes, call any new peer we haven't called yet
  useEffect(() => {
    if (!inCall || !peerRef.current || !myStream) return;
    peerIds.forEach(pid => {
      if (pid === playerId) return;       // skip self
      if (callsRef.current[pid]) return; // already called
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
    if (!playerId) return; // not yet identified by server
    setCamError('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      setCamError('Camera/mic permission denied. Please allow access and try again.');
      return;
    }

    setMyStream(stream);

    // Use playerId as the PeerJS peer ID (sanitise to alphanumeric + dashes)
    const safePeerId = playerId.replace(/[^a-zA-Z0-9-]/g, '-');
    const peer = new Peer(safePeerId, {
      // PeerJS free public server — good for dev/testing
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

    // Answer incoming calls
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
    // Close all active calls
    Object.values(callsRef.current).forEach(c => c.close());
    callsRef.current = {};

    // Stop local tracks
    myStream?.getTracks().forEach(t => t.stop());
    setMyStream(null);
    setStreams({});
    setInCall(false);

    peerRef.current?.destroy();
    peerRef.current = null;

    onCallLeave();
  }

  const remotePeerIds = peerIds.filter(pid => pid !== playerId);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '8px',
    }}>
      {/* Video panel */}
      {open && (
        <div className="animate-scale-in" style={{
          width: 'min(340px, calc(100vw - 40px))',
          background: 'rgba(10,10,24,0.96)',
          border: '1px solid rgba(45,212,191,0.3)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(45,212,191,0.15)',
            background: 'rgba(45,212,191,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📹</span>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--clr-teal)' }}>
                Video Call {inCall && <span style={{ color: 'var(--clr-green)', marginLeft: '4px' }}>● Live</span>}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--clr-text-muted)', fontSize: '1rem',
              }}
            >✕</button>
          </div>

          {/* Video grid */}
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Error */}
            {camError && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--r-sm)',
                background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
                color: 'var(--clr-red)', fontSize: '0.82rem',
              }}>
                {camError}
              </div>
            )}

            {/* My video */}
            {myStream && (
              <div style={{ position: 'relative' }}>
                <video
                  ref={myVideoRef}
                  autoPlay muted playsInline
                  style={{
                    width: '100%', height: '140px',
                    borderRadius: 'var(--r-md)',
                    objectFit: 'cover',
                    background: '#000',
                    border: '2px solid rgba(45,212,191,0.4)',
                  }}
                />
                <span style={{
                  position: 'absolute', bottom: '8px', left: '8px',
                  background: 'rgba(0,0,0,0.6)', borderRadius: '6px',
                  padding: '2px 8px', fontSize: '0.72rem', color: '#fff', fontWeight: 700,
                }}>
                  You
                </span>
              </div>
            )}

            {/* Remote videos */}
            {remotePeerIds.map(pid => {
              const stream = streams[pid];
              return (
                <RemoteVideo key={pid} peerId={pid} stream={stream} />
              );
            })}

            {/* Empty state when no one else is in the call */}
            {inCall && remotePeerIds.length === 0 && (
              <div style={{
                padding: '16px', textAlign: 'center',
                color: 'var(--clr-text-dim)', fontSize: '0.84rem',
              }}>
                <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>👀</div>
                Waiting for others to join the call…
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              {!inCall ? (
                <button
                  id="btn-start-call"
                  className="btn btn--primary btn--full btn--sm"
                  style={{ borderRadius: 'var(--r-md)' }}
                  onClick={startCall}
                >
                  📹 Start Video Call
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
        </div>
      )}

      {/* Pill toggle button */}
      <button
        id="btn-video-toggle"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '10px 18px',
          borderRadius: 'var(--r-full)',
          background: inCall
            ? 'linear-gradient(135deg, #10b981, #2dd4bf)'
            : 'rgba(45,212,191,0.12)',
          border: `1px solid ${inCall ? 'rgba(45,212,191,0.8)' : 'rgba(45,212,191,0.3)'}`,
          color: inCall ? '#fff' : 'var(--clr-teal)',
          fontWeight: 700, fontSize: '0.85rem',
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: inCall ? '0 0 20px rgba(45,212,191,0.4)' : 'none',
          transition: 'all 0.2s',
        }}
      >
        <span>{inCall ? '🔴' : '📹'}</span>
        {inCall ? `Call · ${remotePeerIds.length + 1} joined` : 'Video Call'}
      </button>
    </div>
  );
}

function RemoteVideo({ peerId, stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{ position: 'relative' }}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay playsInline
          style={{
            width: '100%', height: '120px',
            borderRadius: 'var(--r-md)',
            objectFit: 'cover',
            background: '#000',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        />
      ) : (
        <div style={{
          width: '100%', height: '80px',
          borderRadius: 'var(--r-md)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px',
          color: 'var(--clr-text-dim)', fontSize: '0.82rem',
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--clr-amber)',
            animation: 'pulse-urgent 1s ease-in-out infinite alternate',
          }} />
          Connecting…
        </div>
      )}
      <span style={{
        position: 'absolute', bottom: '6px', left: '8px',
        background: 'rgba(0,0,0,0.55)', borderRadius: '6px',
        padding: '2px 8px', fontSize: '0.68rem', color: '#fff', fontWeight: 700,
      }}>
        {peerId.slice(0, 8)}…
      </span>
    </div>
  );
}
