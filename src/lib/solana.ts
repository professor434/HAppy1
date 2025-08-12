// src/lib/solana.ts
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionSignature,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import type { WalletAdapterProps } from "@solana/wallet-adapter-base";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { RPC_HTTP, RPC_WS, assertEnv } from "@/lib/env";

// ---------- Connection ----------
export function makeConnection() {
  assertEnv();
  return new Connection(RPC_HTTP, {
    commitment: "confirmed",
    wsEndpoint: RPC_WS,
    confirmTransactionInitialTimeout: 9_000,
  });
}

// Re-use one connection across the app
export const connection = makeConnection();

// ---------- ENV CONSTANTS ----------
/* eslint-disable @typescript-eslint/no-explicit-any */
const ENV: any = (import.meta as any)?.env ?? {};

export const SPL_MINT_ADDRESS: string =
  ENV.VITE_SPL_MINT_ADDRESS || "GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs";

const TREASURY_WALLET_STR: string =
  ENV.VITE_TREASURY_WALLET || "6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD";

const FEE_WALLET_STR: string =
  ENV.VITE_FEE_WALLET || "J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn";

export const BUY_FEE_PERCENTAGE: number =
  ENV.VITE_BUY_FEE_PERCENTAGE ? Number(ENV.VITE_BUY_FEE_PERCENTAGE) : 2;

export const TREASURY_WALLET = new PublicKey(TREASURY_WALLET_STR);
export const FEE_WALLET = new PublicKey(FEE_WALLET_STR);
export const USDC_MINT_ADDRESS = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

// ---------- Helpers ----------
const toLamports = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL);
const toUSDCUnits = (u: number) => Math.floor(u * 1_000_000);

// One path that works for desktop & mobile (uses sendTransaction when υπάρχει)
async function signAndSendTransaction(
  transaction: Transaction,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet?.publicKey) throw new Error("Wallet not connected");

  // Mobile wallets usually expose sendTransaction()
  if (typeof (wallet as any).sendTransaction === "function") {
    const send = (wallet as any).sendTransaction.bind(wallet);
    const sig: TransactionSignature = await send(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    const res = await connection.confirmTransaction(sig, "confirmed");
    if (res.value?.err) throw new Error("Transaction failed");
    return sig;
  }

  // Fallback: manual sign + robust confirm
  transaction.feePayer = wallet.publicKey!;
  let latest = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = latest.blockhash;

  let signed = await wallet.signTransaction!(transaction);

  const tryOnce = async () => {
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );
    if (confirmation?.value?.err) throw new Error("Transaction error");
    return signature as TransactionSignature;
  };

  try {
    return await tryOnce();
  } catch (e: any) {
    if (String(e?.message || "").includes("blockhash not found")) {
      latest = await connection.getLatestBlockhash("finalized");
      transaction.recentBlockhash = latest.blockhash;
      signed = await wallet.signTransaction!(transaction);
      return await tryOnce();
    }
    // slow mobile networks – poll up to 90s
    const signature = await connection.sendRawTransaction(signed.serialize());
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const st = await connection.getSignatureStatuses([signature]);
      const s = st.value?.[0];
      if (
        s?.confirmationStatus === "confirmed" ||
        s?.confirmationStatus === "finalized"
      )
        break;
      await new Promise((r) => setTimeout(r, 500));
    }
    return signature as TransactionSignature;
  }
}

// ---------- SOL ----------
export async function executeSOLPayment(
  amountSOL: number,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const feePct = BUY_FEE_PERCENTAGE / 100;
  const mainAmount = amountSOL * (1 - feePct);
  const feeAmount = amountSOL * feePct;

  const needed = toLamports(mainAmount + feeAmount) + 5_000;
  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < needed) throw new Error("Insufficient SOL balance.");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: TREASURY_WALLET,
      lamports: toLamports(mainAmount),
    }),
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_WALLET,
      lamports: toLamports(feeAmount),
    })
  );
  return signAndSendTransaction(tx, wallet);
}

// ---------- USDC ----------
export async function executeUSDCPayment(
  amountUSDC: number,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const feePct = BUY_FEE_PERCENTAGE / 100;
  const mainU64 = toUSDCUnits(amountUSDC * (1 - feePct));
  const feeU64 = toUSDCUnits(amountUSDC * feePct);

  const owner = wallet.publicKey;
  const from = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, owner);
  const toMain = await getAssociatedTokenAddress(
    USDC_MINT_ADDRESS,
    TREASURY_WALLET
  );
  const toFee = await getAssociatedTokenAddress(
    USDC_MINT_ADDRESS,
    FEE_WALLET
  );

  const tx = new Transaction();
  try {
    await getAccount(connection, toMain);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        owner,
        toMain,
        TREASURY_WALLET,
        USDC_MINT_ADDRESS
      )
    );
  }
  try {
    await getAccount(connection, toFee);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        owner,
        toFee,
        FEE_WALLET,
        USDC_MINT_ADDRESS
      )
    );
  }

  if (mainU64 > 0)
    tx.add(createTransferInstruction(from, toMain, owner, mainU64));
  if (feeU64 > 0) tx.add(createTransferInstruction(from, toFee, owner, feeU64));

  return signAndSendTransaction(tx, wallet);
}

// ---------- Claim fee ----------
export async function executeClaimFeePayment(
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");

  const claimFeeSOL = ENV.VITE_CLAIM_FEE_SOL
    ? Number(ENV.VITE_CLAIM_FEE_SOL)
    : 0.0005;

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_WALLET,
      lamports: toLamports(claimFeeSOL),
    })
  );
  return signAndSendTransaction(tx, wallet);
}

// small helper
export function formatPublicKey(k: string | PublicKey) {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, 6)}...${s.slice(-6)}`;
}
