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

// ===== ENV / RPC (Extrnode HTTPS + WSS) =====
const ENV = (import.meta as any)?.env ?? {};
const RPC_HTTP: string =
  (ENV.VITE_SOLANA_RPC_HTTP as string) ||
  (ENV.VITE_SOLANA_RPC_URL as string) || // back-compat αν υπήρχε
  "";

const RPC_WS: string =
  (ENV.VITE_SOLANA_RPC_WS as string) ||
  (RPC_HTTP ? RPC_HTTP.replace(/^http/i, "ws") : "");

if (!RPC_HTTP) {
  throw new Error("Missing RPC HTTP (VITE_SOLANA_RPC_HTTP).");
}

export const connection = new Connection(RPC_HTTP, {
  commitment: "confirmed",
  wsEndpoint: RPC_WS || undefined,
});

// ===== CONSTANTS =====
export const SPL_MINT_ADDRESS: string =
  ENV.VITE_SPL_MINT_ADDRESS || "GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs";

const TREASURY_WALLET_STR =
  ENV.VITE_TREASURY_WALLET || "6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD";
const FEE_WALLET_STR =
  ENV.VITE_FEE_WALLET || "J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn";

export const TREASURY_WALLET = new PublicKey(TREASURY_WALLET_STR);
export const FEE_WALLET = new PublicKey(FEE_WALLET_STR);
export const USDC_MINT_ADDRESS = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

// default 0.4% αν δεν δοθεί από env
export const BUY_FEE_PERCENTAGE = ENV.VITE_BUY_FEE_PERCENTAGE
  ? Number(ENV.VITE_BUY_FEE_PERCENTAGE)
  : 0.4;

const toLamports = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL);
const toUSDCUnits = (u: number) => Math.floor(u * 1_000_000);

// ===== HTTP polling confirm (fallback για mobile) =====
async function waitForConfirmation(signature: string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const st = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const s = st.value?.[0];
    if (s?.err) throw new Error("Transaction error");
    if (
      s?.confirmationStatus === "confirmed" ||
      s?.confirmationStatus === "finalized"
    ) {
      return;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Confirmation timeout");
}

// ===== sign/send (mobile first: sendTransaction, αλλιώς sign+raw) =====
async function signAndSendTransaction(
  transaction: Transaction,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet?.publicKey) throw new Error("Wallet not connected");

  transaction.feePayer = wallet.publicKey!;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
    "finalized"
  );
  transaction.recentBlockhash = blockhash;

  if (typeof (wallet as any).sendTransaction === "function") {
    const sig: TransactionSignature = await (wallet as any).sendTransaction(
      transaction,
      connection,
      { skipPreflight: false, maxRetries: 3 }
    );
    // WebSocket confirm (αν υπάρχει) + HTTP fallback
    try {
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );
    } catch {}
    await waitForConfirmation(sig);
    return sig;
  }

  const signed = await wallet.signTransaction!(transaction);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  try {
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
  } catch {}
  await waitForConfirmation(sig);
  return sig;
}

// ===== SOL Payment (main + fee) =====
export async function executeSOLPayment(
  amountSOL: number,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
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

// ===== USDC Payment (main + fee) =====
export async function executeUSDCPayment(
  amountUSDC: number,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
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
  const toFee = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, FEE_WALLET);

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
  if (feeU64 > 0)
    tx.add(createTransferInstruction(from, toFee, owner, feeU64));

  return signAndSendTransaction(tx, wallet);
}

// ===== Claim fee (flat SOL) =====
export async function executeClaimFeePayment(
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
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

export function formatPublicKey(k: string | PublicKey) {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, 6)}...${s.slice(-6)}`;
}
