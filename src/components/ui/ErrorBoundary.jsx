// ═══════════════════════════════════════════════════════════════
//  ERROR BOUNDARY — Catches React render errors with fallback UI
// ═══════════════════════════════════════════════════════════════
/* eslint-disable react-refresh/only-export-components -- class component required; fallback helper colocated. */

import { Component } from 'react';
import T from '../../theme/tokens';

function DefaultFallback({ error, onReset }) {
  return (
    <div className="error-boundary-fallback">
      {/* AlertTriangle icon (lucide) */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke={T.accent.main}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>

      <h2 className="error-boundary-title">Une erreur est survenue</h2>
      <p className="error-boundary-message">
        Un problème inattendu empêche l'affichage de cette page.
      </p>

      {error?.name && (
        <code className="error-boundary-detail">
          {error.name}: {error.message}
        </code>
      )}

      <button className="error-boundary-btn" onClick={onReset}>
        Recharger la page
      </button>
    </div>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <DefaultFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}
