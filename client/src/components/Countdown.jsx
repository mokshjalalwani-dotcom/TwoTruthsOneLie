import { useState, useEffect, useRef } from 'react';

/**
 * Reusable countdown timer.
 * Receives a server `deadline` timestamp (ms since epoch) and
 * recalculates locally every 500ms. Never drifts vs. server time.
 */
export default function Countdown({ deadline, onExpire }) {
  function getRemaining() {
    if (!deadline) return 0;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  }

  const [secs, setSecs] = useState(() => getRemaining());
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setSecs(getRemaining());

    const interval = setInterval(() => {
      const r = getRemaining();
      setSecs(r);
      if (r === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  const urgent  = secs <= 10 && secs > 0;
  const mins    = Math.floor(secs / 60);
  const s       = secs % 60;
  const display = mins > 0
    ? `${mins}:${String(s).padStart(2, '0')}`
    : String(secs);

  return (
    <span className={`countdown${urgent ? ' countdown--urgent' : ''}`}>
      {display}
    </span>
  );
}
