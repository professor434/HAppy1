/* src/lib/rpc.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Connection, clusterApiUrl } from "@solana/web3.js";

const CANDIDATES: Array<{ url: string; headers?: Record<string, string> }> = [
  {
    url: "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2",
    // headers: { "x-api-key": "YOUR_EXTRNODE_KEY" },
  },
  { url: "https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY" },
  { url: "https://solana-api.projectserum.com" },
  { url: clusterApiUrl("mainnet-beta") },
];

let cached: Connection | null = null;

async function healthy(conn: Connection, ms = 2500): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    await conn.getLatestBlockhash({ commitment: "confirmed" }, { signal: ctrl.signal as any });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function getConnection(): Promise<Connection> {
  if (cached) return cached;
  for (const c of CANDIDATES) {
    const conn = new Connection(c.url, {
      commitment: "confirmed",
      httpHeaders: c.headers,
      fetchMiddleware: c.headers
        ? (url, init, fetch) => fetch(url, { ...init, headers: { ...(init?.headers || {}), ...c.headers } })
        : undefined,
    });
    if (await healthy(conn)) {
      cached = conn;
      return conn;
    }
  }
  return new Connection(CANDIDATES[0].url, { commitment: "confirmed", httpHeaders: CANDIDATES[0].headers });
}
