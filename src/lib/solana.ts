/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WalletAdapterProps } from '@solana/wallet-adapter-base';
import {
  Connection, PublicKey, Transaction, SystemProgram, TransactionSignature, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createTransferInstruction, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

// ===== RPC from env (Extrnode) =====
const HTTP = import.meta.env.VITE_SOLANA_RPC_URL as string;
const WS   = import.meta.env.VITE_SOLANA_WS_URL as string | undefined;

export const connection = new Connection(HTTP, {
  commitment: 'confirmed',
  wsEndpoint: WS,
  confirmTransactionInitialTimeout: 90_000,
});

// ===== Project constants =====
export const SPL_MINT_ADDRESS = new PublicKey('GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs');
export const TREASURY_WALLET  = new PublicKey('6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD');
export const FEE_WALLET       = new PublicKey('J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn');
export const USDC_MINT_ADDRESS = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export const BUY_FEE_PERCENTAGE = 0.4; // %

const toLamports  = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL);
const toUSDCUnits = (u: number)   => Math.floor(u * 1_000_000);

// Mobile-friendly sender: προτιμά sendTransaction (in-app), αλλιώς sign+send
async function signAndSendTransaction(
  tx: Transaction,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected');

  if (typeof (wallet as any).sendTransaction === 'function') {
    const sig: TransactionSignature = await (wallet as any).sendTransaction(tx, connection, {
      skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3,
    });
    const res = await connection.confirmTransaction(sig, 'confirmed');
    if (res.value?.err) throw new Error('Transaction failed');
    return sig;
  }

  tx.feePayer = wallet.publicKey;
  const latest = await connection.getLatestBlockhash('finalized');
  tx.recentBlockhash = latest.blockhash;
  const signed = await wallet.signTransaction!(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
  const res = await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    'confirmed'
  );
  if (res.value?.err) throw new Error('Transaction failed');
  return sig;
}

// ===== SOL Payment (main + fee)
export async function executeSOLPayment(
  amountSOL: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error('Wallet not connected');

  const feePct = BUY_FEE_PERCENTAGE / 100;
  const mainAmount = amountSOL * (1 - feePct);
  const feeAmount  = amountSOL * feePct;

  const needed = toLamports(mainAmount + feeAmount) + 5_000;
  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < needed) throw new Error('Insufficient SOL balance.');

  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: TREASURY_WALLET, lamports: toLamports(mainAmount) }),
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: FEE_WALLET,      lamports: toLamports(feeAmount)  }),
  );
  return signAndSendTransaction(tx, wallet);
}

// ===== USDC Payment (main + fee)
export async function executeUSDCPayment(
  amountUSDC: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error('Wallet not connected');

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

// ===== Claim fee (flat SOL)
export async function executeClaimFeePayment(
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'> & { sendTransaction?: any }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error('Wallet not connected');
  const claimFeeSOL = 0.0005;
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: FEE_WALLET, lamports: toLamports(claimFeeSOL) })
  );
  return signAndSendTransaction(tx, wallet);
}

export function formatPublicKey(k: string | PublicKey) {
  const s = typeof k === 'string' ? k : k.toBase58();
  return `${s.slice(0, 6)}...${s.slice(-6)}`;
}

