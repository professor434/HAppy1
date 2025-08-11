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

// ---------- RPC ----------
const ENV = (import.meta as any)?.env ?? {};
const DEFAULT_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
const HTTP = (ENV.VITE_SOLANA_RPC_URL as string) || DEFAULT_HTTP;
const WS = (ENV.VITE_SOLANA_WS_URL as string) || String(HTTP).replace(/^https:/i, "wss:");

export const connection = new Connection(HTTP, {
  commitment: "confirmed",
  wsEndpoint: WS,
  confirmTransactionInitialTimeout: 90_000,
});

// ---------- CONSTANTS ----------
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

export const BUY_FEE_PERCENTAGE =
  ENV.VITE_BUY_FEE_PERCENTAGE ? Number(ENV.VITE_BUY_FEE_PERCENTAGE) : 2;

const toLamports = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL);
const toUSDCUnits = (u: number) => Math.floor(u * 1_000_000);

// ---------- Mobile-safe sign & send ----------
async function signAndSendTransaction(
  transaction: Transaction,
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet?.publicKey) throw new Error("Wallet not connected");

  // 1) Προτιμάμε sendTransaction (ιδανικό για mobile in-app browsers)
  if (typeof (wallet as any).sendTransaction === "function") {
    const sig: TransactionSignature = await (wallet as any).sendTransaction(
      transaction,
      connection,
      { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 }
    );
    const res = await connection.confirmTransaction(sig, "confirmed");
    if (res.value?.err) throw new Error("Transaction failed");
    return sig;
  }

  // 2) Fallback: χειροκίνητο sign + send
  transaction.feePayer = wallet.publicKey!;
  let latest = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = latest.blockhash;

  let signed = await wallet.signTransaction!(transaction);

  const sendAndConfirm = async () => {
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    const conf = await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );
    if (conf?.value?.err) throw new Error("Transaction error");
    return signature as TransactionSignature;
  };

  try {
    return await sendAndConfirm();
  } catch (e: any) {
    if (String(e?.message || "").includes("blockhash not found")) {
      latest = await connection.getLatestBlockhash("finalized");
      transaction.recentBlockhash = latest.blockhash;
      signed = await wallet.signTransaction!(transaction);
      return await sendAndConfirm();
    }
    // HTTP polling fallback
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const st = await connection.getSignatureStatuses([signature]);
      const s = st.value?.[0];
      if (
        s?.confirmationStatus === "confirmed" ||
        s?.confirmationStatus === "finalized"
      )
        break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return signature as TransactionSignature;
  }
}

// ---------- SOL Payment (main + fee) ----------
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

// ---------- USDC Payment (main + fee) ----------
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
  const toMain = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, TREASURY_WALLET);
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
      createAssociatedTokenAccountInstruction(owner, toFee, FEE_WALLET, USDC_MINT_ADDRESS)
    );
  }
  if (mainU64 > 0)
    tx.add(createTransferInstruction(from, toMain, owner, mainU64));
  if (feeU64 > 0)
    tx.add(createTransferInstruction(from, toFee, owner, feeU64));

  return signAndSendTransaction(tx, wallet);
}

// ---------- Claim fee (flat SOL) ----------
export async function executeClaimFeePayment(
  wallet: Pick<WalletAdapterProps, "publicKey" | "signTransaction"> & {
    sendTransaction?: any;
  }
): Promise<TransactionSignature> {
  if (!wallet.publicKey) throw new Error("Wallet not properly connected");
  const claimFeeSOL = ENV.VITE_CLAIM_FEE_SOL ? Number(ENV.VITE_CLAIM_FEE_SOL) : 0.0005;

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
