// src/lib/tx.ts
import type { Commitment, RpcResponseAndContext, SignatureResult } from "@solana/web3.js";
import { Connection, VersionedTransaction } from "@solana/web3.js";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitForVisibility() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "visible") return;
  await new Promise<void>((resolve) => {
    const h = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", h);
        resolve();
      }
    };
    document.addEventListener("visibilitychange", h);
  });
}

export async function confirmWithRetry(
  conn: Connection,
  signature: string,
  params: { blockhash: string; lastValidBlockHeight: number },
  opts?: { commitment?: Commitment; maxSeconds?: number; pollMs?: number }
): Promise<RpcResponseAndContext<SignatureResult>> {
  const commitment = opts?.commitment ?? "confirmed";
  const pollMs = opts?.pollMs ?? 1200;
  const maxSeconds = opts?.maxSeconds ?? 90;
  const deadline = Date.now() + maxSeconds * 1000;

  await waitForVisibility();
  await sleep(400);

  while (Date.now() < deadline) {
    try {
      const res = await conn.confirmTransaction({ signature, ...params }, commitment);
      if (res.value.err == null) return res;
      throw new Error(JSON.stringify(res.value.err));
    } catch {
      // ignore & retry
    }
    await sleep(pollMs);
  }

  const status = await conn.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const st = status?.value?.[0];
  if (st?.err == null && st?.confirmationStatus) {
    return { context: { apiVersion: null as any, slot: st.slot ?? 0 }, value: { err: null } };
  }
  throw new Error("Transaction not confirmed within timeout");
}

// Quick ack for fast UI after signing
export async function sendAndAckVersionedTx(
  conn: Connection,
  tx: VersionedTransaction,
  sendTx: (tx: VersionedTransaction) => Promise<string>
) {
  await sleep(150);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("processed");
  const sig = await sendTx(tx);
  await confirmWithRetry(conn, sig, { blockhash, lastValidBlockHeight }, {
    commitment: "processed",
    maxSeconds: 30,
    pollMs: 600,
  });
  return sig;
}

export async function sendAndConfirmVersionedTx(
  conn: Connection,
  tx: VersionedTransaction,
  sendTx: (tx: VersionedTransaction) => Promise<string>
) {
  await sleep(250);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const sig = await sendTx(tx);
  await confirmWithRetry(conn, sig, { blockhash, lastValidBlockHeight }, {
    commitment: "finalized",
    maxSeconds: 90,
    pollMs: 1200,
  });
  return sig;
}
