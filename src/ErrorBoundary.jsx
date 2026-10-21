import React from 'react';
import { DICT } from './i18n';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error, _info) {
    // Error caught by boundary so sibling UI stays mounted
  }

  handleRetry() {
    this.setState({ hasError: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  render() {
    if (this.state.hasError) {
      const lang = this.props.lang || 'ar';
      const t = DICT[lang] || DICT.en;
      return (
        <div className="surface-card empty-state-box" role="alert">
          <div className="empty-state-illustration" aria-hidden="true">
            ⚠️
          </div>
          <h2 className="empty-state-title">
            {t.errorBoundaryTitle || 'Something went wrong'}
          </h2>
          <p className="empty-state-text">
            {t.errorBoundaryText || 'Please try reopening this view.'}
          </p>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: '14px' }}
            onClick={this.handleRetry}
          >
            ↺ {t.errorBoundaryRetryBtn || 'Try again'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
