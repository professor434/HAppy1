// src/lib/env.ts
import type { Commitment } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

// Δίκτυο
export const NETWORK =
  (process.env.NEXT_PUBLIC_NETWORK ?? 'mainnet-beta') as
    | 'mainnet-beta'
    | 'devnet'
    | 'testnet';

// === RPCs (ΔΙΚΑ ΣΟΥ) ===
// Primary: extranode (πληρωμένο)
export const RPC_PRIMARY =
  process.env.NEXT_PUBLIC_RPC_PRIMARY ??
  'https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2';

// Fallback: QuickNode
export const RPC_FALLBACK =
  process.env.NEXT_PUBLIC_RPC_FALLBACK ??
  'https://broken-purple-breeze.solana-mainnet.quiknode.pro/b087363c02a61ba4c37f9acd5c3c4dcc7b20420f';

// Confirmation level (mobile-friendly)
export const COMMITMENT: Commitment =
  (process.env.NEXT_PUBLIC_COMMITMENT as Commitment) ?? 'confirmed';

// Μεγαλύτερο timeout για mobile (ms)
export const TX_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_TX_TIMEOUT_MS ?? 90000 // 90s
);

// Optional priority fee (micro-lamports per CU). 0 = off
export const PRIORITY_FEE_MICRO_LAMPORTS = Number(
  process.env.NEXT_PUBLIC_PRIORITY_FEE ?? 5000
);

// Upper bound compute units (ασφαλές default)
export const COMPUTE_UNIT_LIMIT = Number(
  process.env.NEXT_PUBLIC_COMPUTE_UNIT_LIMIT ?? 800000
);

// ===== Σταθερές token/wallets (όπως τα έχεις) =====
export const SPL_MINT_ADDRESS = new PublicKey(
  'GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs'
);
export const TREASURY_WALLET = new PublicKey(
  '6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD'
);
export const FEE_WALLET = new PublicKey(
  'J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn'
);
// USDC (mainnet – πλήρες)
export const USDC_MINT_ADDRESS = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

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
  throw new Error("Transaction not finalized within timeout");
}

// Quick ack for fast UI after signing
export async function sendAndAckVersionedTx(
  conn: Connection,
  tx: VersionedTransaction,
  sendTx: (tx: VersionedTransaction) => Promise<string>,
  opts?: { skipOnMobile?: boolean }
) {
  await sleep(150);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
  const sig = await sendTx(tx);
  await confirmWithRetry(conn, sig, { blockhash, lastValidBlockHeight }, {
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
  await sleep(250);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
  const sig = await sendTx(tx);
  await confirmWithRetry(conn, sig, { blockhash, lastValidBlockHeight }, {
    commitment: "finalized",
    maxSeconds: 90,
    pollMs: 1200,
    skipOnMobile: opts?.skipOnMobile,
  });
  return sig;
}
