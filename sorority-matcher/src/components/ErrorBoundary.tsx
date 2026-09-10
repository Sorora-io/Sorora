import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Error boundaries have no hooks equivalent — React only recognizes
// getDerivedStateFromError/componentDidCatch on a class component.
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in Sorora:', error, info.componentStack);
  }

  handleReload = () => {
    // A hard navigation, not react-router's navigate() — the error may
    // have come from router/context state itself, so re-mounting the
    // whole app from scratch is the safer reset.
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <svg width="72" height="40" viewBox="0 0 72 40" fill="none" className="mb-4" aria-hidden="true">
          <circle cx="24" cy="20" r="14" fill="#DCEDE8" />
          <circle cx="48" cy="20" r="14" fill="#F2E6C6" />
          <circle cx="36" cy="20" r="6" fill="#296F62" />
        </svg>
        <h2 className="text-2xl font-display font-semibold mb-2 text-jade-800">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-6 max-w-sm">
          We hit an unexpected error. Reloading usually fixes it — nothing you've saved was lost.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="px-6 py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
        >
          Reload Sorora
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
