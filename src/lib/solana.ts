// src/lib/solana.ts
// Όλα όσα χρειάζεται το frontend για Solana, καθαρά και σταθερά.

import {
  Commitment,
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SignatureResult,
  VersionedTransaction,
} from "@solana/web3.js";

/* =========================
 *  ENV (Vite client-side)
 *  =========================
 * ΜΟΝΟ μεταβλητές με VITE_ περνάνε στον client:
 * - VITE_SOLANA_RPC_URL
 * - VITE_SOLANA_WS_URL
 * - VITE_SOLANA_QUICKNODE_URL (fallback)
 * - VITE_SOLANA_COMMITMENT  (optional: "confirmed" | "finalized" | "processed")
 */
const RPC_PRIMARY =
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ??
  "https://api.mainnet-beta.solana.com";

const RPC_FALLBACK =
  (import.meta.env.VITE_SOLANA_QUICKNODE_URL as string | undefined) ?? "";

const WS_ENDPOINT = import.meta.env.VITE_SOLANA_WS_URL as string | undefined;

export const COMMITMENT: Commitment =
  ((import.meta.env.VITE_SOLANA_COMMITMENT as Commitment | undefined) ??
    "confirmed") as Commitment;

// Λίγο πιο γενναιόδωρο timeout (mobile-friendly)
const HTTP_TIMEOUT_MS = 30_000;

/* =========================
 *  Connection helpers
 * ========================= */
export function makeConnection(rpc = RPC_PRIMARY): Connection {
  // confirmTransactionInitialTimeout: βοηθά όταν το δίκτυο αργεί
  return new Connection(rpc, {
    commitment: COMMITMENT,
    wsEndpoint: WS_ENDPOINT,
    confirmTransactionInitialTimeout: HTTP_TIMEOUT_MS,
    disableRetryOnRateLimit: false,
  });
}

// Singleton βασική σύνδεση
let _conn = makeConnection();
export function getConnection(): Connection {
  return _conn;
}

// Γρήγορο health check για primary και fallback
export async function getHealthyConnection(): Promise<Connection> {
  const tryPing = async (conn: Connection) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    try {
      await conn.getEpochInfo(COMMITMENT);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  };

  if (await tryPing(_conn)) return _conn;

  if (RPC_FALLBACK && RPC_FALLBACK !== RPC_PRIMARY) {
    const alt = makeConnection(RPC_FALLBACK);
    if (await tryPing(alt)) {
      _conn = alt;
      return _conn;
    }
  }
  // αν όλα αποτύχουν, γύρνα την τρέχουσα (θα γίνει retry στους callers)
  return _conn;
}

/* =========================
 *  Small utilities
 * ========================= */
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForVisibility(skipOnMobile?: boolean) {
  if (skipOnMobile) return; // σε mobile μην μπλοκάρεις UI
  if (typeof document === "undefined") return;
  if (document.visibilityState !== "hidden") return;
  await new Promise<void>((resolve) => {
    const onVis = () => {
      if (document.visibilityState !== "hidden") {
        document.removeEventListener("visibilitychange", onVis);
        resolve();
      }
    };
    document.addEventListener("visibilitychange", onVis);
  });
}

/* =========================
 *  TX confirm helpers (βασισμένα στην πρακτική των dApps)
 * ========================= */
export async function confirmWithRetry(
  conn: Connection,
  signature: string,
  params: { blockhash: string; lastValidBlockHeight: number },
  opts?: {
    commitment?: Commitment;
    maxSeconds?: number;
    pollMs?: number;
    skipOnMobile?: boolean;
  }
): Promise<RpcResponseAndContext<SignatureResult>> {
  const commitment = opts?.commitment ?? "finalized";
  const pollMs = opts?.pollMs ?? 1200;
  const maxSeconds = opts?.maxSeconds ?? 120;
  const deadline = Date.now() + maxSeconds * 1000;

  await waitForVisibility(opts?.skipOnMobile);
  await sleep(250);

  while (Date.now() < deadline) {
    try {
      const res = await conn.confirmTransaction(
        { signature, ...params },
        commitment
      );
      if (res.value.err == null) return res;
      // Αν υπάρχει ρητό error, σταμάτα
      throw new Error(JSON.stringify(res.value.err));
    } catch {
      // αγνόησε transient σφάλματα και ξαναπροσπάθησε
    }
    await sleep(pollMs);
  }

  // Τελικός έλεγχος στο history
  const status = await conn.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const st = status?.value?.[0];
  if (st?.err == null && st?.confirmationStatus) {
    return {
      context: { apiVersion: undefined, slot: st.slot ?? 0 },
      value: { err: null },
    };
  }
  throw new Error("Transaction not finalized within timeout");
}

// Γρήγορη αποστολή + επιβεβαίωση (UI-friendly)
export async function sendAndAckVersionedTx(
  conn: Connection,
  tx: VersionedTransaction,
  sendTx: (tx: VersionedTransaction) => Promise<string>,
  opts?: { skipOnMobile?: boolean }
) {
  await sleep(120);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash(
    "finalized"
  );
  const sig = await sendTx(tx);
  await confirmWithRetry(
    conn,
    sig,
    { blockhash, lastValidBlockHeight },
    {
      commitment: "finalized",
      maxSeconds: 30,
      pollMs: 600,
      skipOnMobile: opts?.skipOnMobile,
    }
  );
  return sig;
}

export async function sendAndConfirmVersionedTx(
  conn: Connection,
  tx: VersionedTransaction,
  sendTx: (tx: VersionedTransaction) => Promise<string>,
  opts?: { skipOnMobile?: boolean }
) {
  await sleep(200);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash(
    "finalized"
  );
  const sig = await sendTx(tx);
  await confirmWithRetry(
    conn,
    sig,
    { blockhash, lastValidBlockHeight },
    {
      commitment: "finalized",
      maxSeconds: 90,
      pollMs: 1200,
      skipOnMobile: opts?.skipOnMobile,
    }
  );
  return sig;
}

/* =========================
 *  PublicKey helpers
 * ========================= */
export function toPublicKey(key: string | PublicKey): PublicKey {
  return typeof key === "string" ? new PublicKey(key) : key;
}

/** Κόβει ωραία ένα base58 address για εμφάνιση στο UI. */
export function formatPublicKey(
  key: string | PublicKey,
  opts: { prefix?: number; suffix?: number } = {}
): string {
  const { prefix = 4, suffix = 4 } = opts;
  const base58 = typeof key === "string" ? key : key.toBase58();
  if (base58.length <= prefix + suffix) return base58;
  return `${base58.slice(0, prefix)}…${base58.slice(-suffix)}`;
}

// Alias αν το προτιμάς
export const shortAddress = formatPublicKey;

/* =========================
 *  Default export (optional)
 * ========================= */
export default {
  getConnection,
  getHealthyConnection,
  makeConnection,
  formatPublicKey,
  shortAddress,
  toPublicKey,
  sendAndAckVersionedTx,
  sendAndConfirmVersionedTx,
  confirmWithRetry,
  COMMITMENT,
};
