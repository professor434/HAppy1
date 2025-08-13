// src/lib/solana.ts
import {
  Connection, PublicKey, VersionedTransaction, TransactionInstruction,
  TransactionMessage, ComputeBudgetProgram, Commitment, RpcResponseAndContext, SignatureResult
} from "@solana/web3.js";
import { COMMITMENT, TX_TIMEOUT_MS, VITE_SOLANA_RPC_URL } from "@/lib/env";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const makeConnection = () =>
  new Connection(VITE_SOLANA_RPC_URL, { commitment: COMMITMENT });

export async function buildV0Tx(
  payer: PublicKey, ixs: TransactionInstruction[], conn = makeConnection()
): Promise<VersionedTransaction> {
  const { blockhash } = await conn.getLatestBlockhash({ commitment: COMMITMENT as Commitment });
  const msg = new TransactionMessage({
    payerKey: payer, recentBlockhash: blockhash, instructions: [
      // μικρό compute budget για συνέπεια, χωρίς υπερβολές
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ...ixs,
    ],
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}

// Απλό, στιβαρό confirm με polling + searchTransactionHistory
export async function confirmWithRetry(
  conn: Connection, signature: string,
  params: { blockhash: string; lastValidBlockHeight: number },
  opts?: { commitment?: Commitment; maxSeconds?: number; pollMs?: number }
): Promise<RpcResponseAndContext<SignatureResult>> {
  const commitment = opts?.commitment ?? "finalized";
  const pollMs = opts?.pollMs ?? 1200;
  const deadline = Date.now() + 1000 * (opts?.maxSeconds ?? Math.round(TX_TIMEOUT_MS / 1000));

  while (Date.now() < deadline) {
    try {
      const res = await conn.confirmTransaction({ signature, ...params }, commitment);
      if (res.value.err == null) return res;
    } catch {}
    await sleep(pollMs);
  }
  const st = (await conn.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
  if (st?.err == null && st?.confirmationStatus) {
    return { context: { apiVersion: undefined, slot: st.slot ?? 0 }, value: { err: null } };
  }
  throw new Error("Transaction not finalized within timeout");
}

export async function signSendAndConfirm(
  wallet: { signAndSendTransaction?: (tx: VersionedTransaction)=>Promise<{signature: string}>;
            signTransaction?: (tx: VersionedTransaction)=>Promise<VersionedTransaction>; },
  payer: PublicKey, ixs: TransactionInstruction[],
): Promise<string> {
  const conn = makeConnection();
  const tx = await buildV0Tx(payer, ixs, conn);

  // Σε mobile, άφησε το wallet να κάνει send (MWA/Phantom) — πιο αξιόπιστο. :contentReference[oaicite:4]{index=4}
  if (wallet.signAndSendTransaction) {
    const { signature } = await wallet.signAndSendTransaction(tx);
    const bh = await conn.getLatestBlockhash(COMMITMENT);
    await confirmWithRetry(conn, signature, bh, { commitment: "finalized" });
    return signature;
  }
  // Desktop/legacy path
  const signed = wallet.signTransaction ? await wallet.signTransaction(tx) : tx;
  const sig = await conn.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
  const bh = await conn.getLatestBlockhash(COMMITMENT);
  await confirmWithRetry(conn, sig, bh, { commitment: "finalized" });
  return sig;
}
