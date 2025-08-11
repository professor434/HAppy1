/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WalletAdapterProps } from '@solana/wallet-adapter-base';
import {
  Connection, PublicKey, Transaction, SystemProgram, TransactionSignature, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createTransferInstruction, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

const ENV: any = (import.meta as any)?.env ?? {};
const RPC_HTTP = String(ENV.VITE_SOLANA_RPC_URL ?? "").trim();
const RPC_WS   = String(ENV.VITE_SOLANA_WS_URL ?? (RPC_HTTP ? RPC_HTTP.replace(/^http(s?):/, "ws$1:") : "")).trim();

if (!/^https?:\/\//.test(RPC_HTTP)) {
  throw new Error("VITE_SOLANA_RPC_URL must be a valid https:// endpoint");
}

export const connection = new Connection(RPC_HTTP, {
  commitment: "confirmed",
  wsEndpoint: RPC_WS || undefined,
  confirmTransactionInitialTimeout: 120_000,
});

export const SPL_MINT_ADDRESS = "GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs";
export const TREASURY_WALLET  = new PublicKey("6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD");
export const FEE_WALLET       = new PublicKey("J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn");
export const USDC_MINT_ADDRESS = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const BUY_FEE_PERCENTAGE = 0.4;

const toLamports = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL);
const toUSDCUnits = (u: number) => Math.floor(u * 1_000_000);

async function signAndSendTransaction(
  transaction: Transaction,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet?.publicKey) throw new Error("Wallet not connected");

  if (typeof (wallet as any).sendTransaction === "function") {
    const send = (wallet as any).sendTransaction.bind(wallet);
    const sig: TransactionSignature = await send(transaction, connection, {
      skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3,
    });
    const ok = await connection.confirmTransaction(sig, "confirmed");
    if (ok.value?.err) throw new Error("Transaction failed");
    return sig;
  }

  transaction.feePayer = wallet.publicKey!;
  const latest = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = latest.blockhash;

  const signed = await wallet.signTransaction!(transaction);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
  const res = await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed"
  );
  if (res.value?.err) throw new Error("Transaction failed");
  return sig;
}

export async function executeSOLPayment(amountSOL: number, wallet: any) {
  const feePct = BUY_FEE_PERCENTAGE / 100;
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: TREASURY_WALLET, lamports: toLamports(amountSOL * (1 - feePct)) }),
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: FEE_WALLET,      lamports: toLamports(amountSOL * feePct) }),
  );
  return signAndSendTransaction(tx, wallet);
}

export async function executeUSDCPayment(amountUSDC: number, wallet: any) {
  const feePct  = BUY_FEE_PERCENTAGE / 100;
  const mainU64 = toUSDCUnits(amountUSDC * (1 - feePct));
  const feeU64  = toUSDCUnits(amountUSDC * feePct);

  const owner  = wallet.publicKey;
  const from   = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, owner);
  const toMain = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, TREASURY_WALLET);
  const toFee  = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, FEE_WALLET);

  const tx = new Transaction();
  try { await getAccount(connection, toMain); } catch { tx.add(createAssociatedTokenAccountInstruction(owner, toMain, TREASURY_WALLET, USDC_MINT_ADDRESS)); }
  try { await getAccount(connection, toFee); } catch { tx.add(createAssociatedTokenAccountInstruction(owner, toFee, FEE_WALLET,       USDC_MINT_ADDRESS)); }
  if (mainU64 > 0) tx.add(createTransferInstruction(from, toMain, owner, mainU64));
  if (feeU64  > 0) tx.add(createTransferInstruction(from, toFee,  owner, feeU64));

  return signAndSendTransaction(tx, wallet);
}

export async function executeClaimFeePayment(wallet: any) {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: FEE_WALLET, lamports: toLamports(0.0005) })
  );
  return signAndSendTransaction(tx, wallet);
}

export function formatPublicKey(k: string | PublicKey) {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, 6)}...${s.slice(-6)}`;
}
