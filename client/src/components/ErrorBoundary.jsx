import { Component } from 'react';

/**
 * Top-level error boundary.
 * Catches any unhandled render-time error in the component tree and shows
 * a friendly "rejoin" screen instead of a blank page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught:', error, info?.componentStack);
  }

  handleRejoin() {
    // Clear stale localStorage so a fresh join is possible
    localStorage.removeItem('tt_playerId');
    localStorage.removeItem('tt_roomCode');
    window.location.href = '/';
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          gap: '20px',
          background: 'var(--clr-bg)',
          color: 'var(--clr-text)',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        <div style={{ fontSize: '3rem' }}>😵</div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Something went wrong</h2>
        <p style={{ color: 'var(--clr-text-muted)', maxWidth: '340px' }}>
          An unexpected error occurred. Your room might still be active — click below to go back and rejoin.
        </p>
        <button
          id="btn-rejoin-after-error"
          onClick={this.handleRejoin}
          style={{
            padding: '14px 32px',
            borderRadius: '9999px',
            border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #2dd4bf 100%)',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(139,92,246,0.4)',
          }}
        >
          ↩ Back to Home
        </button>

        {import.meta.env.DEV && this.state.error && (
          <pre
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(244,63,94,0.1)',
              border: '1px solid rgba(244,63,94,0.3)',
              borderRadius: '8px',
              color: 'var(--clr-red)',
              fontSize: '0.75rem',
              textAlign: 'left',
              maxWidth: '600px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    );
  }
}
