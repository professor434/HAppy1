/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/lib/solana.ts */
import type { WalletAdapterProps } from "@solana/wallet-adapter-base";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionSignature } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

// ===== RPC (HTTPS + WSS) =====

const ENV_VARS = (import.meta as any)?.env || {};
const RAW_HTTP = ENV_VARS.VITE_SOLANA_RPC_URL || ENV_VARS.VITE_SOLANA_QUICKNODE_URL || "";
const RAW_WS   = ENV_VARS.VITE_SOLANA_WS_URL || "";


function assertHttps(u: string) {
  if (!/^https:\/\//i.test(u)) throw new Error("VITE_SOLANA_RPC_URL must be a valid https:// endpoint");
}
const RPC_HTTP = (() => {
  const u = String(RAW_HTTP).trim();
  assertHttps(u);
  return u;
})();
const RPC_WS   = RAW_WS ? String(RAW_WS).trim() : RPC_HTTP.replace(/^https/i, "wss");

export const connection = new Connection(RPC_HTTP, {
  commitment: "confirmed",
  wsEndpoint: RPC_WS,
  confirmTransactionInitialTimeout: 90_000,
});

// ===== Constants (βάλε από env εκεί που έχεις ήδη) =====

export const SPL_MINT_ADDRESS: string =
  ENV_VARS.VITE_SPL_MINT_ADDRESS || "GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs";

const TREASURY_WALLET_STR =
  ENV_VARS.VITE_TREASURY_WALLET || "6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD";

const FEE_WALLET_STR =
  ENV_VARS.VITE_FEE_WALLET || "J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn";

export const BUY_FEE_PERCENTAGE =
  ENV_VARS.VITE_BUY_FEE_PERCENTAGE ? Number(ENV_VARS.VITE_BUY_FEE_PERCENTAGE) : 2;


export const TREASURY_WALLET = new PublicKey(TREASURY_WALLET_STR);
export const FEE_WALLET = new PublicKey(FEE_WALLET_STR);
export const USDC_MINT_ADDRESS = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const toLamports  = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL);
const toUSDCUnits = (u: number) => Math.floor(u * 1_000_000);

// ===== Mobile-friendly signer =====
async function signAndSendTransaction(
  transaction: Transaction,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet?.publicKey) throw new Error("Wallet not connected");

  // 1) Προτίμησε sendTransaction (mobile-friendly)
  if (typeof (wallet as any).sendTransaction === "function") {
    const send = (wallet as any).sendTransaction.bind(wallet);
    const sig: TransactionSignature = await send(transaction, connection, {
      preflightCommitment: "confirmed",
      skipPreflight: false,
      maxRetries: 3,
    });
    // Επιβεβαίωση με WS + fallback
    const latest = await connection.getLatestBlockhash("finalized");
    const conf = await connection.confirmTransaction(
      { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed"
    );
    if (conf.value?.err) throw new Error("Transaction failed");
    return sig;
  }

  // 2) Fallback: signTransaction -> sendRawTransaction
  transaction.feePayer = wallet.publicKey!;
  const latest = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = latest.blockhash;

  const signed = await wallet.signTransaction!(transaction);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
  const conf = await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed"
  );
  if (conf.value?.err) throw new Error("Transaction failed");
  return sig;
}

// ===== SOL Payment (main + fee) =====
export async function executeSOLPayment(
  amountSOL: number,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const feePct = BUY_FEE_PERCENTAGE / 100;
  const mainAmount = amountSOL * (1 - feePct);
  const feeAmount  = amountSOL * feePct;

  const needed = toLamports(mainAmount + feeAmount) + 5_000;
  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < needed) throw new Error("Insufficient SOL balance.");

  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: TREASURY_WALLET, lamports: toLamports(mainAmount) }),
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: FEE_WALLET,      lamports: toLamports(feeAmount)  }),
  );
  return signAndSendTransaction(tx, wallet);
}

// ===== USDC Payment (main + fee) =====
export async function executeUSDCPayment(
  amountUSDC: number,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const feePct  = BUY_FEE_PERCENTAGE / 100;
  const mainU64 = toUSDCUnits(amountUSDC * (1 - feePct));
  const feeU64  = toUSDCUnits(amountUSDC * feePct);

  const owner  = wallet.publicKey;
  const from   = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, owner);
  const toMain = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, TREASURY_WALLET);
  const toFee  = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, FEE_WALLET);

  const tx = new Transaction();
  try { await getAccount(connection, toMain); } catch {
    tx.add(createAssociatedTokenAccountInstruction(owner, toMain, TREASURY_WALLET, USDC_MINT_ADDRESS));
  }
  try { await getAccount(connection, toFee); } catch {
    tx.add(createAssociatedTokenAccountInstruction(owner, toFee, FEE_WALLET, USDC_MINT_ADDRESS));
  }
  if (mainU64 > 0) tx.add(createTransferInstruction(from, toMain, owner, mainU64));
  if (feeU64  > 0) tx.add(createTransferInstruction(from, toFee,  owner, feeU64));

  return signAndSendTransaction(tx, wallet);
}

// ===== Claim Fee (flat SOL) =====
export async function executeClaimFeePayment(
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const claimFeeSOL = ENV_VARS.VITE_CLAIM_FEE_SOL ? Number(ENV_VARS.VITE_CLAIM_FEE_SOL) : 0.0005;


  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: FEE_WALLET, lamports: toLamports(claimFeeSOL) })
  );
  return signAndSendTransaction(tx, wallet);
}

export function formatPublicKey(k: string | PublicKey) {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, 6)}...${s.slice(-6)}`;
}
