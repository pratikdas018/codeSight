import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";
import { CodeSightLogo } from "./CodeSightLogo";

interface ErrorBoundaryProps extends PropsWithChildren {
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6 py-10 text-slate-100">
        <section className="w-full max-w-xl rounded-3xl border border-[#262626] bg-[#101010] p-8 shadow-2xl">
          <CodeSightLogo compact />
          <div className="mt-8 text-xs uppercase tracking-[0.24em] text-[#6c7c6d]">
            Workspace recovery
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#ebffe2]">
            AlgoLoom needs to restart this view.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#9aad9e]">
            The workspace encountered an unexpected display error. Your saved snippets and account data are not removed.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20"
          >
            Reload workspace
          </button>
        </section>
      </main>
    );
  }
}
