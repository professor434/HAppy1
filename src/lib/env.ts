// src/lib/env.ts
// Κεντρική πηγή αλήθειας για API/RPC URLs με ασφαλή fallbacks.

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const E = (import.meta as any)?.env ?? {};

export const API_BASE_URL =
  s(E.VITE_API_BASE_URL) || "https://happy-pennis.up.railway.app";

const DEFAULT_RPC_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

// let (όχι const) για να μπορούμε να “αυτοδιορθώνουμε”
export let RPC_HTTP = s(E.VITE_SOLANA_RPC_URL) || DEFAULT_RPC_HTTP;
export let RPC_WS =
  s(E.VITE_SOLANA_WS_URL) ||
  RPC_HTTP.replace(/^https?:/, (p) => (p.startsWith("https") ? "wss:" : "ws:"));

/** Μαλακώνουμε τα strict checks ώστε να ΜΗΝ σκάει λευκή σελίδα. */
export function assertEnv() {
  // Επιτρέπουμε τοπικό dev (http://localhost:8899 κ.λπ.) — απλά κάνουμε warn
  const isLocalHttp =
    RPC_HTTP.startsWith("http://localhost") ||
    RPC_HTTP.startsWith("http://127.0.0.1");

  if (!/^https:\/\//.test(RPC_HTTP) && !isLocalHttp) {
    console.warn(
      "Bad/empty VITE_SOLANA_RPC_URL:",
      JSON.stringify(RPC_HTTP),
      "→ falling back to default mainnet RPC",
    );
    RPC_HTTP = DEFAULT_RPC_HTTP;
  }

  const isLocalWs =
    RPC_WS.startsWith("ws://localhost") || RPC_WS.startsWith("ws://127.0.0.1");

  if (!/^wss:\/\//.test(RPC_WS) && !isLocalWs) {
    // ανακατασκευάζουμε από το HTTP
    try {
      const u = new URL(RPC_HTTP);
      u.protocol = "wss:";
      RPC_WS = u.toString().replace(/\/$/, "");
    } catch {
      RPC_WS = DEFAULT_RPC_HTTP.replace(/^https:/, "wss:");
    }
    console.warn("Adjusted VITE_SOLANA_WS_URL →", RPC_WS);
  }

  // Βάλε τα runtime για εύκολο debug από Console
  if (typeof window !== "undefined") {
    (window as any).__CONF__ = { API_BASE_URL, RPC_HTTP, RPC_WS };
  }
}
