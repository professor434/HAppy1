// ====== Env / RPC (robust) ======
function clean(v: unknown) {
  return String(v ?? "").replace(/^['"]|['"]$/g, "").trim();
}

const HTTP_ENV = clean(import.meta.env.VITE_SOLANA_RPC_URL ?? (import.meta as any)?.env?.SOLANA_RPC);
const WS_ENV   = clean(import.meta.env.VITE_SOLANA_WS_URL);

// ίδιο project id της Extrnode
const FALLBACK_HTTP = "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

const RPC_HTTP = /^https:\/\//i.test(HTTP_ENV) ? HTTP_ENV : FALLBACK_HTTP;
const RPC_WS   = /^wss:\/\//i.test(WS_ENV) ? WS_ENV : RPC_HTTP.replace(/^https/i, "wss");

export const connection = new Connection(RPC_HTTP, {
  commitment: "confirmed",
  wsEndpoint: RPC_WS,
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
