import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-line bg-surface p-6 text-center">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted">{this.state.error.message}</p>
        <button className="btn-primary mt-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
