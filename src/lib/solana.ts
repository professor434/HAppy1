// src/lib/solana.ts
// Σταθερό frontend Solana helper: connection, V0 tx build, confirm, κ.λπ.

import {
  Commitment,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SignatureResult,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";

/* =========== ENV (Vite client-side) =========== */
const RPC_PRIMARY =
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ??
  "https://api.mainnet-beta.solana.com";

const RPC_FALLBACK =
  (import.meta.env.VITE_SOLANA_QUICKNODE_URL as string | undefined) ?? "";

const WS_ENDPOINT = import.meta.env.VITE_SOLANA_WS_URL as string | undefined;

export const COMMITMENT: Commitment =
  ((import.meta.env.VITE_SOLANA_COMMITMENT as Commitment | undefined) ??
    "confirmed") as Commitment;

const HTTP_TIMEOUT_MS = 30_000;

/* =========== Connection helpers =========== */
export function makeConnection(rpc = RPC_PRIMARY): Connection {
  return new Connection(rpc, {
    commitment: COMMITMENT,
    wsEndpoint: WS_ENDPOINT,
    confirmTransactionInitialTimeout: HTTP_TIMEOUT_MS,
    disableRetryOnRateLimit: false,
  });
}
let _conn = makeConnection();
export function getConnection(): Connection { return _conn; }

export async function getHealthyConnection(): Promise<Connection> {
  const ping = async (c: Connection) => {
    try { await c.getEpochInfo(COMMITMENT); return true; } catch { return false; }
  };
  if (await ping(_conn)) return _conn;
  if (RPC_FALLBACK && RPC_FALLBACK !== RPC_PRIMARY) {
    const alt = makeConnection(RPC_FALLBACK);
    if (await ping(alt)) { _conn = alt; return _conn; }
  }
  return _conn;
}

/* =========== Small utils =========== */
export function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
export async function waitForVisibility(skipOnMobile?: boolean) {
  if (skipOnMobile || typeof document === "undefined") return;
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
export function toPublicKey(k: string | PublicKey): PublicKey {
  return typeof k === "string" ? new PublicKey(k) : k;
}
export function formatPublicKey(
  key: string | PublicKey,
  opts: { prefix?: number; suffix?: number } = {}
): string {
  const { prefix = 4, suffix = 4 } = opts;
  const base58 = typeof key === "string" ? key : key.toBase58();
  if (base58.length <= prefix + suffix) return base58;
  return `${base58.slice(0, prefix)}…${base58.slice(-suffix)}`;
}
export const shortAddress = formatPublicKey;

/* =========== Confirm helpers =========== */
export async function confirmWithRetry(
  conn: Connection,
  signature: string,
  params: { blockhash: string; lastValidBlockHeight: number },
  opts?: { commitment?: Commitment; maxSeconds?: number; pollMs?: number; skipOnMobile?: boolean }
): Promise<RpcResponseAndContext<SignatureResult>> {
  const commitment = opts?.commitment ?? "finalized";
  const pollMs = opts?.pollMs ?? 1200;
  const maxSeconds = opts?.maxSeconds ?? 120;
  const deadline = Date.now() + maxSeconds * 1000;

  await waitForVisibility(opts?.skipOnMobile);
  await sleep(250);

  while (Date.now() < deadline) {
    try {
      const res = await conn.confirmTransaction({ signature, ...params }, commitment);
      if (res.value.err == null) return res;
      throw new Error(JSON.stringify(res.value.err));
    } catch {}
    await sleep(pollMs);
  }

  const status = await conn.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const st = status?.value?.[0];
  if (st?.err == null && st?.confirmationStatus) {
    return { context: { apiVersion: undefined, slot: st.slot ?? 0 }, value: { err: null } };
  }
  throw new Error("Transaction not finalized within timeout");
}

/* =========== NEW: buildV0Tx =========== */
/**
 * Φτιάχνει **Versioned (v0)** συναλλαγή με optional Compute Budget & Priority Fee.
 * - Χρησιμοποιεί `TransactionMessage` + `VersionedTransaction`.
 * - Δέχεται optional Address Lookup Tables (για μεγάλα tx).
 * Docs: versioned tx & compute budget, getLatestBlockhash. 
 */
export async function buildV0Tx(opts: {
  conn: Connection;
  payer: PublicKey;
  instructions: TransactionInstruction[];
  lookupTables?: AddressLookupTableAccount[]; // optional
  computeUnitLimit?: number;                  // π.χ. 400_000 .. 800_000
  priorityFeeMicroLamports?: number;          // π.χ. 5_000 .. 50_000
  recent?: { blockhash: string; lastValidBlockHeight: number }; // αν έχεις ήδη
}): Promise<{ tx: VersionedTransaction; recent: { blockhash: string; lastValidBlockHeight: number } }> {
  const { conn, payer, lookupTables = [], computeUnitLimit, priorityFeeMicroLamports } = opts;

  // 1) Προσάρμοσε Compute Budget (αν δοθεί)
  const pre: TransactionInstruction[] = [];
  if (computeUnitLimit && computeUnitLimit > 0) {
    pre.push(ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }));
  }
  if (priorityFeeMicroLamports && priorityFeeMicroLamports > 0) {
    pre.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeMicroLamports }));
  }

  // 2) Blockhash (finalized — όπως προτείνουν τα docs)
  const recent = opts.recent ?? await conn.getLatestBlockhash("finalized");

  // 3) Χτίσιμο V0 message (με ή χωρίς LUTs)
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: recent.blockhash,
    instructions: [...pre, ...opts.instructions],
  }).compileToV0Message(lookupTables);

  const tx = new VersionedTransaction(messageV0);
  return { tx, recent };
}

/* =========== NEW: signSendAndConfirm =========== */
/**
 * Υπογράφει+στέλνει (wallet adapter) και κάνει **σωστό confirm** με lastValidBlockHeight.
 * - Δουλεύει με VersionedTransaction.
 * - Σε mobile μπορείς να περάσεις skipOnMobile για μικρότερη αναμονή UI.
 * Docs: wallet-adapter sendTransaction, Phantom signAndSend, confirmation flow.
 */
export async function signSendAndConfirm(args: {
  conn: Connection;
  wallet: { sendTransaction: (tx: VersionedTransaction, c: Connection, o?: any) => Promise<string> };
  tx: VersionedTransaction;
  recent?: { blockhash: string; lastValidBlockHeight: number };
  commitment?: Commitment;        // default "finalized"
  skipOnMobile?: boolean;
}): Promise<string> {
  const { conn, wallet, tx } = args;
  const recent = args.recent ?? (await conn.getLatestBlockhash("finalized"));
  const sig = await wallet.sendTransaction(tx, conn, {
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  await confirmWithRetry(conn, sig, recent, {
    commitment: args.commitment ?? "finalized",
    maxSeconds: 60,
    pollMs: 900,
    skipOnMobile: args.skipOnMobile,
  });
  return sig;
}

/* =========== Convenience wrappers (αν τα χρειαστείς) =========== */
export async function sendAndAckVersionedTx(
  conn: Connection,
  tx: VersionedTransaction,
  sendTx: (tx: VersionedTransaction) => Promise<string>,
  opts?: { skipOnMobile?: boolean }
) {
  await sleep(120);
  const recent = await conn.getLatestBlockhash("finalized");
  const sig = await sendTx(tx);
  await confirmWithRetry(conn, sig, recent, {
    commitment: "finalized",
    maxSeconds: 30,
    pollMs: 600,
    skipOnMobile: opts?.skipOnMobile,
  });
  return sig;
}
export async function sendAndConfirmVersionedTx(
  conn: Connection,
  tx: VersionedTransaction,
  sendTx: (tx: VersionedTransaction) => Promise<string>,
  opts?: { skipOnMobile?: boolean }
) {
  await sleep(200);
  const recent = await conn.getLatestBlockhash("finalized");
  const sig = await sendTx(tx);
  await confirmWithRetry(conn, sig, recent, {
    commitment: "finalized",
    maxSeconds: 90,
    pollMs: 1200,
    skipOnMobile: opts?.skipOnMobile,
  });
  return sig;
}

/* =========== Default export (προαιρετικό) =========== */
export default {
  getConnection,
  getHealthyConnection,
  makeConnection,
  buildV0Tx,
  signSendAndConfirm,
  formatPublicKey,
  shortAddress,
  toPublicKey,
  sendAndAckVersionedTx,
  sendAndConfirmVersionedTx,
  confirmWithRetry,
  COMMITMENT,
};
