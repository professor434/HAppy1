// src/lib/env.ts
/* Κεντρική ανάγνωση & έλεγχος ENV για Vite (build-time) + ασφαλή defaults */

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const E = (import.meta as any)?.env ?? {};

export const API_BASE_URL =
  s(E.VITE_API_BASE_URL) || "https://happy-pennis.up.railway.app";

export const RPC_HTTP =
  s(E.VITE_SOLANA_RPC_URL) ||
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

export const RPC_WS =
  s(E.VITE_SOLANA_WS_URL) ||
  RPC_HTTP.replace(/^https:/, "wss:");

export function assertEnv() {
  if (!RPC_HTTP.startsWith("https://")) {
    console.error("Bad VITE_SOLANA_RPC_URL:", JSON.stringify(RPC_HTTP));
    throw new Error("VITE_SOLANA_RPC_URL must be a valid https:// endpoint");
  }
  if (!/^wss:\/\//.test(RPC_WS)) {
    console.error("Bad VITE_SOLANA_WS_URL:", JSON.stringify(RPC_WS));
    throw new Error("VITE_SOLANA_WS_URL must be a valid wss:// endpoint");
  }
  if (typeof window !== "undefined") {
    (window as any).__CONF__ = { API_BASE_URL, RPC_HTTP, RPC_WS };
  }
}
