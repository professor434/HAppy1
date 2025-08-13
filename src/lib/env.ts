// src/lib/env.ts
// Κεντρικό config + ασφαλή fallbacks. Καμία ρίψη σφάλματος στο runtime.

import { Connection } from "@solana/web3.js";

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
const PRIMARY_RPC =
  s(E.VITE_SOLANA_RPC_URL) ||
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
const QUICKNODE_RPC =
  s(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (E as any).VITE_SOLANA_QUICKNODE_URL
  ) || "https://solana-mainnet.quiknode.pro/";

export const RPC_URLS = [PRIMARY_RPC, QUICKNODE_RPC];

export let RPC_HTTP = RPC_URLS[0];
export let RPC_WS = RPC_HTTP.replace(/^https:/, "wss:");

async function ping(url: string) {
  const conn = new Connection(url, { commitment: "finalized" });
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 3_000)
  );
  await Promise.race([conn.getVersion(), timeout]);
}

export async function selectRpc() {
  for (const url of RPC_URLS) {
    try {
      await ping(url);
      return { http: url, ws: url.replace(/^https:/, "wss:") };
    } catch {
      console.warn("RPC unreachable:", url);
    }
  }
  const url = RPC_URLS[0];
  return { http: url, ws: url.replace(/^https:/, "wss:") };
}

// Δεν πετάμε πια error. Κάνουμε auto-fix + warn.
export async function assertEnv() {
  if (!RPC_HTTP.startsWith("https://")) {
    console.warn(
      "Bad VITE_SOLANA_RPC_URL:",
      JSON.stringify(RPC_HTTP),
      "→ falling back to default"
    );
    RPC_HTTP = RPC_URLS[0];
    RPC_WS = RPC_HTTP.replace(/^https:/, "wss:");
  }
  if (!/^wss:\/\//.test(RPC_WS)) {
    console.warn(
      "Bad VITE_SOLANA_WS_URL:",
      JSON.stringify(RPC_WS),
      "→ falling back to default"
    );
    RPC_WS = RPC_HTTP.replace(/^https:/, "wss:");
  }

  try {
    await ping(RPC_HTTP);
  } catch {
    const { http, ws } = await selectRpc();
    RPC_HTTP = http;
    RPC_WS = ws;
  }

  // Βάλ’ τα στο window για εύκολο έλεγχο από Console
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__CONF__ = { API_BASE_URL, RPC_HTTP, RPC_WS };
  }
}
