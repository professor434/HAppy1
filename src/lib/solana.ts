/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WalletAdapterProps } from "@solana/wallet-adapter-base";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

/* ---------------- RPC (με ασφαλές fallback) ---------------- */
const DEFAULT_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

const HTTP =
  ((import.meta as any)?.env?.VITE_SOLANA_RPC_URL as string | undefined)?.trim() ||
  DEFAULT_HTTP;

const WS =
  ((import.meta as any)?.env?.VITE_SOLANA_WS_URL as string | undefined)?.trim() ||
  HTTP.replace(/^https?/i, "wss");

export const connection = new Connection(HTTP, {
  commitment: "confirmed",
  wsEndpoint: WS,
  confirmTransactionInitialTimeout: 90_000,
});

// βοηθάει στο debugging από console
if (typeof window !== "undefined") (window as any).__RPC__ = { HTTP, WS };

/* ---------------- Σταθερές ---------------- */
export const SPL_MINT_ADDRESS =
  ((import.meta as any)?.env?.VITE_SPL_MINT_ADDRESS as string) ||
  "GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs";

const TREASURY_WALLET_STR =
  ((import.meta as any)?.env?.VITE_TREASURY_WALLET as string) ||
  "6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD";

const FEE_WALLET_STR =
  ((import.meta as any)?.env?.VITE_FEE_WALLET as string) ||
  "J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn";

export const BUY_FEE_PERCENTAGE =
  (Number((import.meta as any)?.env?.VITE_BUY_FEE_PERCENTAGE) || 2) * 1;

export const TREASURY_WALLET = new PublicKey(TREASURY_WALLET_STR);
export const FEE_WALLET = new PublicKey(FEE_WALLET_STR);

export const USDC_MINT_ADDRESS = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

const toLamports = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL);
const toUSDCUnits = (u: number) => Math.floor(u * 1_000_000);

/* ---------------- Mobile-safe send ---------------- */
async function signAndSendTransaction(
  transaction: Transaction,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet?.publicKey) throw new Error("Wallet not connected");

  // 1) Προτίμησε sendTransaction (mobile)
  if (typeof (wallet as any).sendTransaction === "function") {
    const send = (wallet as any).sendTransaction.bind(wallet);
    const sig: TransactionSignature = await send(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    // extra polling (iOS wallets καθυστερούν)
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const st = await connection.getSignatureStatuses([sig]);
      const s = st.value?.[0];
      if (
        s?.confirmationStatus === "confirmed" ||
        s?.confirmationStatus === "finalized"
      )
        break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return sig;
  }

  // 2) Fallback: manual sign
  transaction.feePayer = wallet.publicKey!;
  let latest = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = latest.blockhash;

  let signed = await wallet.signTransaction!(transaction);

  const sendAndConfirm = async () => {
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
    return await sendAndConfirm();
  } catch {
    // ανανέωσε blockhash κι άλλη μια προσπάθεια
    latest = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = latest.blockhash;
    signed = await wallet.signTransaction!(transaction);
    return await sendAndConfirm();
  }
}

/* ---------------- SOL Payment (main + fee) ---------------- */
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

/* ---------------- USDC Payment (main + fee) ---------------- */
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
  if (feeU64 > 0) tx.add(createTransferInstruction(from, toFee, owner, feeU64));

  return signAndSendTransaction(tx, wallet);
}

/* ---------------- Claim Fee (flat SOL) ---------------- */
export async function executeClaimFeePayment(
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");
  const claimFeeSOL =
    Number((import.meta as any)?.env?.VITE_CLAIM_FEE_SOL) || 0.0005;

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
