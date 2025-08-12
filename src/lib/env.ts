// src/lib/env.ts
// Κεντρικό config + ασφαλή fallbacks. Καμία ρίψη σφάλματος στο runtime.

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const E = (import.meta as any)?.env ?? {};

// --- API (Railway) ---
export const API_BASE_URL =
  s(E.VITE_API_BASE_URL) || "https://happy-pennis.up.railway.app";

// --- RPC HTTP/WS (Solana) ---
// Τα κρατάμε let για να μπορούμε να αυτο-διορθώνουμε στο runtime.
export let RPC_HTTP =
  s(E.VITE_SOLANA_RPC_URL) ||
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

export let RPC_WS =
  s(E.VITE_SOLANA_WS_URL) ||
  RPC_HTTP.replace(/^https:/, "wss:");

// Δεν πετάμε πια error. Κάνουμε auto-fix + warn.
export function assertEnv() {
  if (!RPC_HTTP.startsWith("https://")) {
    console.warn(
      "Bad VITE_SOLANA_RPC_URL:",
      JSON.stringify(RPC_HTTP),
      "→ falling back to default"
    );
    RPC_HTTP =
      "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
  }
  if (!/^wss:\/\//.test(RPC_WS)) {
    console.warn(
      "Bad VITE_SOLANA_WS_URL:",
      JSON.stringify(RPC_WS),
      "→ falling back to default"
    );
    RPC_WS = RPC_HTTP.replace(/^https:/, "wss:");
  }

  // Βάλ’ τα στο window για εύκολο έλεγχο από Console
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__CONF__ = { API_BASE_URL, RPC_HTTP, RPC_WS };
  }
}
