/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WalletAdapterProps } from "@solana/wallet-adapter-base";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionSignature,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

// ---------- ENV & RPC (robust, never throws) ----------
const ENV = (import.meta as any)?.env ?? {};

// Τα δικά σου Extrnode endpoints (βάλε τα env στο Vercel/Railway):
// VITE_SOLANA_RPC_URL = https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2
// VITE_SOLANA_WS_URL  = wss://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2
const FALLBACK_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
const FALLBACK_WS =
  "wss://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

const RPC_HTTP: string =
  ENV.VITE_SOLANA_RPC_URL ||
  ENV.VITE_RPC_URL ||
  ENV.SOLANA_RPC ||
  FALLBACK_HTTP;

const RPC_WS: string =
  ENV.VITE_SOLANA_WS_URL ||
  (RPC_HTTP.startsWith("http")
    ? RPC_HTTP.replace(/^http(s?):\/\//, "wss://")
    : FALLBACK_WS);

// Η σύνδεση ΔΕΝ ρίχνει error αν λείπει env — πάντα έχουμε fallback
export const connection = new Connection(RPC_HTTP, {
  commitment: "confirmed",
  wsEndpoint: RPC_WS,
  confirmTransactionInitialTimeout: 90_000,
});

// ---------- CONSTANTS ----------
export const SPL_MINT_ADDRESS = "GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs";
export const TREASURY_WALLET  = new PublicKey("6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD");
export const FEE_WALLET       = new PublicKey("J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn");
export const USDC_MINT_ADDRESS = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Προμήθειες (μπορείς να τις δώσεις και με env)
export const BUY_FEE_PERCENTAGE =
  ENV.VITE_BUY_FEE_PERCENTAGE ? Number(ENV.VITE_BUY_FEE_PERCENTAGE) : 0.4;
const CLAIM_FEE_SOL =
  ENV.VITE_CLAIM_FEE_SOL ? Number(ENV.VITE_CLAIM_FEE_SOL) : 0.002;

// ---------- HELPERS ----------
const toLamports = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL);
const toUSDCUnits = (u: number) => Math.floor(u * 1_000_000);

export function formatPublicKey(k: string | PublicKey) {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, 6)}...${s.slice(-6)}`;
}

// sendTransaction-first (mobile), με ασφαλή fallbacks
async function signAndSendTransaction(
  tx: Transaction,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet?.publicKey) throw new Error("Wallet not connected");

  // 1) Αν υπάρχει sendTransaction (Phantom/Solflare mobile)
  if (typeof (wallet as any).sendTransaction === "function") {
    const send = (wallet as any).sendTransaction.bind(wallet);
    const sig: TransactionSignature = await send(tx, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    // μικρή επιβεβαίωση
    const r = await connection.confirmTransaction(sig, "confirmed");
    if (r.value?.err) throw new Error("Transaction error");
    return sig;
  }

  // 2) Manual signing
  tx.feePayer = wallet.publicKey!;
  let latest = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = latest.blockhash;

  let signed = await wallet.signTransaction!(tx);

  const trySend = async () => {
    const sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    const conf = await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );
    if (conf.value?.err) throw new Error("Transaction error");
    return sig as TransactionSignature;
  };

  try {
    return await trySend();
  } catch (e: any) {
    // Αν έχει λήξει το blockhash, ξαναυπογράφουμε
    if (String(e?.message || "").includes("blockhash")) {
      latest = await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = latest.blockhash;
      signed = await wallet.signTransaction!(tx);
      try {
        return await trySend();
      } catch {
        // πιο safe polling
      }
    }

    // 3) Polling μέχρι 90s
    const sig = await connection.sendRawTransaction(signed.serialize());
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const st = await connection.getSignatureStatuses([sig]);
      const s = st.value?.[0];
      if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return sig as TransactionSignature;
  }
}

// ---------- PAYMENTS ----------
export async function executeSOLPayment(
  amountSOL: number,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const feePct = BUY_FEE_PERCENTAGE / 100;
  const main = amountSOL * (1 - feePct);
  const fee  = amountSOL * feePct;

  const needed = toLamports(main + fee) + 5_000;
  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < needed) throw new Error("Insufficient SOL balance.");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: TREASURY_WALLET,
      lamports: toLamports(main),
    }),
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_WALLET,
      lamports: toLamports(fee),
    })
  );

  return signAndSendTransaction(tx, wallet);
}

export async function executeUSDCPayment(
  amountUSDC: number,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const feePct = BUY_FEE_PERCENTAGE / 100;
  const mainU = toUSDCUnits(amountUSDC * (1 - feePct));
  const feeU  = toUSDCUnits(amountUSDC * feePct);

  const owner = wallet.publicKey;
  const from  = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, owner);
  const toMain = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, TREASURY_WALLET);
  const toFee  = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, FEE_WALLET);

  const tx = new Transaction();

  try { await getAccount(connection, toMain); }
  catch {
    tx.add(createAssociatedTokenAccountInstruction(owner, toMain, TREASURY_WALLET, USDC_MINT_ADDRESS));
  }
  try { await getAccount(connection, toFee); }
  catch {
    tx.add(createAssociatedTokenAccountInstruction(owner, toFee, FEE_WALLET, USDC_MINT_ADDRESS));
  }

  if (mainU > 0) tx.add(createTransferInstruction(from, toMain, owner, mainU));
  if (feeU  > 0) tx.add(createTransferInstruction(from, toFee,  owner, feeU));

  return signAndSendTransaction(tx, wallet);
}

export async function executeClaimFeePayment(
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const lamports = toLamports(CLAIM_FEE_SOL);
  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < lamports + 5000) throw new Error("Insufficient balance for claim fee.");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_WALLET,
      lamports,
    })
  );
  return signAndSendTransaction(tx, wallet);
}
