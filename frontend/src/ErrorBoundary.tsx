import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erreur applicative interceptée :", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, fontFamily: "system-ui, sans-serif", background: "#1C1730",
        }}>
          <div style={{ maxWidth: 480, background: "#fff", borderRadius: 16, padding: 28 }}>
            <h1 style={{ fontSize: 20, marginBottom: 10, color: "#1C1730" }}>💥 Une erreur est survenue</h1>
            <p style={{ fontSize: 13, color: "#565070", marginBottom: 12 }}>
              Ouvrez la console du navigateur (F12) pour le détail complet. Message :
            </p>
            <pre style={{ background: "#FCEAEA", color: "#E14A4A", padding: 12, borderRadius: 8, fontSize: 12.5, overflowX: "auto", whiteSpace: "pre-wrap" }}>
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: "none", background: "#F68B00", color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
