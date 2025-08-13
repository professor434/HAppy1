// src/lib/solana.ts
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  TransactionInstruction,
  TransactionMessage,
  ComputeBudgetProgram,
  SendOptions,
  Commitment,
  RpcResponseAndContext,
  SignatureResult,
} from '@solana/web3.js';

import {
  RPC_PRIMARY,
  RPC_FALLBACK,
  COMMITMENT,
  TX_TIMEOUT_MS,
  PRIORITY_FEE_MICRO_LAMPORTS,
  COMPUTE_UNIT_LIMIT,
  SPL_MINT_ADDRESS,
  TREASURY_WALLET,
  FEE_WALLET,
  USDC_MINT_ADDRESS,
} from './env';

// ---------- Helpers ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isMobile =
  typeof navigator !== 'undefined' &&
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

async function waitForVisibility(skipOnMobile?: boolean) {
  if (skipOnMobile && isMobile) return;
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') return;
  await new Promise<void>((resolve) => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', handler);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', handler);
  });
}

// ---------- Connections ----------
export const makeConnection = (endpoint?: string) =>
  new Connection(endpoint ?? RPC_PRIMARY, { commitment: COMMITMENT });

const withFallback = async <T>(a: () => Promise<T>, b: () => Promise<T>) => {
  try { return await a(); } catch (e) { console.warn('[RPC primary failed]', e); return await b(); }
};

// ---------- Build v0 tx (compute + priority) ----------
export async function buildV0Tx(
  payer: PublicKey,
  ixs: TransactionInstruction[],
  connection?: Connection
): Promise<VersionedTransaction> {
  const conn = connection ?? makeConnection();
  const { blockhash } = await withFallback(
    () => conn.getLatestBlockhash({ commitment: COMMITMENT as Commitment }),
    () => makeConnection(RPC_FALLBACK).getLatestBlockhash({ commitment: COMMITMENT as Commitment }),
  );

  const budgetIxs: TransactionInstruction[] = [];
  if (COMPUTE_UNIT_LIMIT > 0)
    budgetIxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }));
  if (PRIORITY_FEE_MICRO_LAMPORTS > 0)
    budgetIxs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICRO_LAMPORTS }));

  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [...budgetIxs, ...ixs],
  }).compileToV0Message();

  return new VersionedTransaction(msg);
}

// ---------- Confirm helpers (όπως τα έγραψες) ----------
export async function confirmWithRetry(
  conn: Connection,
  signature: string,
  params: { blockhash: string; lastValidBlockHeight: number },
  opts?: { commitment?: Commitment; maxSeconds?: number; pollMs?: number; skipOnMobile?: boolean }
): Promise<RpcResponseAndContext<SignatureResult>> {
  const commitment = opts?.commitment ?? 'finalized';
  const pollMs = opts?.pollMs ?? 1200;
  const maxSeconds = opts?.maxSeconds ?? 120;
  const deadline = Date.now() + maxSeconds * 1000;

  await waitForVisibility(opts?.skipOnMobile);
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
    return { context: { apiVersion: undefined, slot: st.slot ?? 0 }, value: { err: null } };
  }
  throw new Error('Transaction not finalized within timeout');
}

// Γρήγορο ack για UI μετά την υπογραφή
export async function sendAndAckVersionedTx(
  conn: Connection,
  tx: VersionedTransaction,
  sendTx: (tx: VersionedTransaction) => Promise<string>,
  opts?: { skipOnMobile?: boolean }
) {
  await sleep(150);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');
  const sig = await sendTx(tx);
  await confirmWithRetry(conn, sig, { blockhash, lastValidBlockHeight }, {
    commitment: 'finalized',
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
  await sleep(250);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');
  const sig = await sendTx(tx);
  await confirmWithRetry(conn, sig, { blockhash, lastValidBlockHeight }, {
    commitment: 'finalized',
    maxSeconds: Math.round(TX_TIMEOUT_MS / 1000),
    pollMs: 1200,
    skipOnMobile: opts?.skipOnMobile,
  });
  return sig;
}

// ---------- Robust path με manual send + fallback ----------
export async function sendAndConfirmRobust(
  connection: Connection,
  tx: VersionedTransaction,
  opts?: SendOptions & { timeoutMs?: number }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? TX_TIMEOUT_MS;
  const sendOpts: SendOptions = { skipPreflight: false, maxRetries: 3, ...opts };

  const sig = await withFallback(
    () => connection.sendRawTransaction(tx.serialize(), sendOpts),
    () => makeConnection(RPC_FALLBACK).sendRawTransaction(tx.serialize(), sendOpts),
  );

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await withFallback(
      () => connection.getSignatureStatuses([sig], { searchTransactionHistory: true }),
      () => makeConnection(RPC_FALLBACK).getSignatureStatuses([sig], { searchTransactionHistory: true }),
    );
    const st = res.value[0];
    if (st?.err) throw new Error(`Transaction failed: ${JSON.stringify(st.err)} (sig: ${sig})`);
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return sig;
    await sleep(1200);
  }
  throw new Error(`Confirmation timeout after ${Math.round(timeoutMs / 1000)}s. Signature: ${sig}.`);
}

// ---------- Mobile-friendly high-level ----------
export async function signSendAndConfirm(
  wallet: {
    signTransaction?: (tx: VersionedTransaction)=>Promise<VersionedTransaction>;
    signAndSendTransaction?: (tx: VersionedTransaction, opts?: any)=>Promise<{ signature: string }>;
  },
  payer: PublicKey,
  ixs: TransactionInstruction[],
): Promise<string> {
  const conn = makeConnection();
  const tx = await buildV0Tx(payer, ixs, conn);

  if (wallet.signAndSendTransaction) {
    const { signature } = await wallet.signAndSendTransaction(tx, { maxRetries: 3 });
    await confirmWithRetry(conn, signature, await conn.getLatestBlockhash('finalized'), {
      commitment: 'finalized',
      maxSeconds: Math.round(TX_TIMEOUT_MS / 1000),
      pollMs: 1200,
      skipOnMobile: true,
    });
    return signature;
  }

  if (!wallet.signTransaction) throw new Error('Wallet adapter does not support signing transactions.');
  const signed = await wallet.signTransaction(tx);
  return await sendAndConfirmRobust(conn, signed, { timeoutMs: TX_TIMEOUT_MS });
}

// Re-exports
export { SPL_MINT_ADDRESS, TREASURY_WALLET, FEE_WALLET, USDC_MINT_ADDRESS };
