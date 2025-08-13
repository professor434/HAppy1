// src/lib/env.ts
import type { Commitment } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

// -------- Network --------
export const NETWORK =
  (process.env.NEXT_PUBLIC_NETWORK ?? 'mainnet-beta') as
    | 'mainnet-beta' | 'devnet' | 'testnet';

// -------- RPCs (ΔΙΚΑ ΣΟΥ) --------
// Primary: EXTRANODE (πληρωμένο)
export const RPC_PRIMARY =
  process.env.NEXT_PUBLIC_RPC_PRIMARY ??
  'https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2';

// Fallback: QUICKNODE
export const RPC_FALLBACK =
  process.env.NEXT_PUBLIC_RPC_FALLBACK ??
  'https://broken-purple-breeze.solana-mainnet.quiknode.pro/b087363c02a61ba4c37f9acd5c3c4dcc7b20420f';

// Για τον Provider: ένα HTTP endpoint & ένα WS endpoint (από το PRIMARY)
// Αν το provider σου δέχεται ws ξεχωριστά, αυτά αρκούν. Αλλιώς άστο κενό.
export const RPC_HTTP = RPC_PRIMARY;
export const RPC_WS = RPC_PRIMARY.replace(/^http/i, 'ws');

// -------- Commitments / timeouts / compute --------
export const COMMITMENT: Commitment =
  (process.env.NEXT_PUBLIC_COMMITMENT as Commitment) ?? 'confirmed';

export const TX_TIMEOUT_MS =
  Number(process.env.NEXT_PUBLIC_TX_TIMEOUT_MS ?? 90000); // 90s

export const PRIORITY_FEE_MICRO_LAMPORTS =
  Number(process.env.NEXT_PUBLIC_PRIORITY_FEE ?? 5000);

export const COMPUTE_UNIT_LIMIT =
  Number(process.env.NEXT_PUBLIC_COMPUTE_UNIT_LIMIT ?? 800000);

// -------- Public keys (όπως τα έχεις) --------
export const SPL_MINT_ADDRESS = new PublicKey(
  'GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs'
);
export const TREASURY_WALLET = new PublicKey(
  '6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD'
);
export const FEE_WALLET = new PublicKey(
  'J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn'
);
export const USDC_MINT_ADDRESS = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

// -------- Optional: μικρός έλεγχος env για τον Provider --------
export async function assertEnv(): Promise<void> {
  // εδώ μπορείς να κάνεις ό,τι sanity checks θες
  if (!RPC_HTTP) throw new Error('Missing RPC_HTTP');
}
