// src/ErrorBoundary.tsx
import React, { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error?: unknown };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: undefined };

  static getDerivedStateFromError(error: unknown): State {
    // Δείχνουμε fallback UI αντί για «λευκή»
    return { error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Log για prod/analytics
    console.error("[UI ERROR]", error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ padding: 20, color: "#c00", fontFamily: "ui-sans-serif" }}>
          <h2>Κάτι πήγε στραβά στο render.</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(error?.message ?? error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
