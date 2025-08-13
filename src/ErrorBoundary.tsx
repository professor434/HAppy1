import { Component, ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { err?: any }> {
  state = { err: undefined as any };
  static getDerivedStateFromError(err: any) { return { err }; } // δείξε fallback UI
  componentDidCatch(err: any, info: any) { console.error("[UI ERROR]", err, info); } // log
  render() {
    if (this.state.err) {
      return (
        <div style={{padding:20, color:"#f55", fontFamily:"ui-sans-serif"}}>
          <h2>Κάτι πήγε στραβά στο render.</h2>
          <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.err?.message ?? this.state.err)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
