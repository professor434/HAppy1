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

// ----- Connection helpers -----
export const makeConnection = (endpoint?: string) =>
  new Connection(endpoint ?? RPC_PRIMARY, { commitment: COMMITMENT });

const withFallback = async <T>(a: () => Promise<T>, b: () => Promise<T>) => {
  try { return await a(); } catch (e) { console.warn('[RPC primary failed]', e); return await b(); }
};

// ----- Build v0 tx (compute + priority fee) -----
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
  if (COMPUTE_UNIT_LIMIT > 0) budgetIxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }));
  if (PRIORITY_FEE_MICRO_LAMPORTS > 0)
    budgetIxs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICRO_LAMPORTS }));

  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [...budgetIxs, ...ixs],
  }).compileToV0Message();

  return new VersionedTransaction(msg);
}

// ----- Robust send + confirm (polling με timeout & retries) -----
export async function sendAndConfirmRobust(
  connection: Connection,
  tx: VersionedTransaction,
  opts?: SendOptions & { timeoutMs?: number }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? TX_TIMEOUT_MS;
  const sendOpts: SendOptions = { skipPreflight: false, maxRetries: 3, ...opts };

  // 1) send με primary, αλλιώς fallback
  const sig = await withFallback(
    () => connection.sendRawTransaction(tx.serialize(), sendOpts),
    () => makeConnection(RPC_FALLBACK).sendRawTransaction(tx.serialize(), sendOpts),
  );

  // 2) poll μέχρι confirm/finalize
  const start = Date.now(); const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
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
  throw new Error(`Confirmation timeout after ${Math.round(timeoutMs/1000)}s. Signature: ${sig}.`);
}

// ----- High-level helper (mobile-friendly) -----
export async function signSendAndConfirm(
  wallet: {
    signTransaction?: (tx: VersionedTransaction)=>Promise<VersionedTransaction>;
    signAndSendTransaction?: (tx: VersionedTransaction, opts?: any)=>Promise<{ signature: string }>;
    supportedTransactionVersions?: Set<number>|null;
  },
  payer: PublicKey,
  ixs: TransactionInstruction[],
): Promise<string> {
  const conn = makeConnection();
  const tx = await buildV0Tx(payer, ixs, conn);

  // Mobile Phantom/solflare: πιο γρήγορο
  if (wallet.signAndSendTransaction) {
    const { signature } = await wallet.signAndSendTransaction(tx, { maxRetries: 3 });
    await sendAndConfirmRobust(conn, tx, { timeoutMs: TX_TIMEOUT_MS });
    return signature;
  }

  if (!wallet.signTransaction) throw new Error('Wallet adapter does not support signing transactions.');
  const signed = await wallet.signTransaction(tx);
  return await sendAndConfirmRobust(conn, signed, { timeoutMs: TX_TIMEOUT_MS });
}

// Επανεξάγουμε ό,τι ήδη χρησιμοποιείται αλλού
export { SPL_MINT_ADDRESS, TREASURY_WALLET, FEE_WALLET, USDC_MINT_ADDRESS };