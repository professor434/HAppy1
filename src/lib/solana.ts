import { WalletAdapterProps } from '@solana/wallet-adapter-base';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionSignature,
  LAMPORTS_PER_SOL,
  clusterApiUrl
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

// --- Constants ---
export const SPL_MINT_ADDRESS = new PublicKey('6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD');
export const FEE_WALLET = new PublicKey('J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn');
export const USDC_MINT_ADDRESS = new PublicKey('6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD');
export const SOLANA_RPC_URL = clusterApiUrl('mainnet-beta');
export const BUY_FEE_PERCENTAGE = 0.1;
export const CLAIM_FEE_PERCENTAGE = 0.4;
export const connection = new Connection(SOLANA_RPC_URL);

// --- Helpers ---
export const calculateFee = (amount: number, percentage: number): number =>
  amount * (percentage / 100);

export const formatPublicKey = (key: string | PublicKey): string => {
  const keyStr = typeof key === 'string' ? key : key.toString();
  return `${keyStr.slice(0, 4)}...${keyStr.slice(-4)}`;
};

// --- SOL Payment ---
export async function executeSOLPayment(
  amount: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  console.log("💸 Starting SOL payment execution", { amount });

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not properly connected');
  }

  const feeAmount = calculateFee(amount, BUY_FEE_PERCENTAGE);
  const mainAmount = amount - feeAmount;
  const lamportsToSend = Math.floor(mainAmount * LAMPORTS_PER_SOL) + Math.floor(feeAmount * LAMPORTS_PER_SOL);
  const balance = await connection.getBalance(wallet.publicKey);

  if (balance < lamportsToSend + 5000) {
    throw new Error("Insufficient SOL balance for transaction and fees.");
  }

  const transaction = new Transaction();
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: SPL_MINT_ADDRESS,
      lamports: Math.floor(mainAmount * LAMPORTS_PER_SOL),
    }),
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_WALLET,
      lamports: Math.floor(feeAmount * LAMPORTS_PER_SOL),
    })
  );

  transaction.feePayer = wallet.publicKey;
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const signedTransaction = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());

  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${confirmation.value.err}`);
  }

  console.log("✅ SOL payment confirmed");
  return signature;
}

// --- USDC Payment ---
export async function executeUSDCPayment(
  amount: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  console.log("💰 Starting USDC payment execution", { amount });

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not properly connected');
  }

  const fromTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_ADDRESS,
    wallet.publicKey
  );

  try {
    await getAccount(connection, fromTokenAccount);
  } catch (error) {
    throw new Error('You do not have a USDC token account. Please fund your wallet with USDC first.');
  }

  const tokenDecimals = 6;
  const feeAmount = calculateFee(amount, BUY_FEE_PERCENTAGE);
  const mainAmount = amount - feeAmount;

  const adjustedMainAmount = Math.floor(mainAmount * 10 ** tokenDecimals);
  const adjustedFeeAmount = Math.floor(feeAmount * 10 ** tokenDecimals);

  const toMainTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_ADDRESS,
    SPL_MINT_ADDRESS,
    true
  );

  const toFeeTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_ADDRESS,
    FEE_WALLET,
    true
  );

  const transaction = new Transaction();

  try {
    await getAccount(connection, toMainTokenAccount);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        toMainTokenAccount,
        SPL_MINT_ADDRESS,
        USDC_MINT_ADDRESS
      )
    );
  }

  try {
    await getAccount(connection, toFeeTokenAccount);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        toFeeTokenAccount,
        FEE_WALLET,
        USDC_MINT_ADDRESS
      )
    );
  }

  transaction.add(
    createTransferInstruction(
      fromTokenAccount,
      toMainTokenAccount,
      wallet.publicKey,
      adjustedMainAmount
    ),
    createTransferInstruction(
      fromTokenAccount,
      toFeeTokenAccount,
      wallet.publicKey,
      adjustedFeeAmount
    )
  );

  transaction.feePayer = wallet.publicKey;
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const signedTransaction = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());

  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${confirmation.value.err}`);
  }

  console.log("✅ USDC payment confirmed");
  return signature;
}

// --- Claim Fee Payment ---
export async function executeClaimFeePayment(
  tokenAmount: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const feeInSol = 0.001;
  const lamports = Math.floor(feeInSol * LAMPORTS_PER_SOL);
  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < lamports + 5000) {
    throw new Error("Insufficient SOL balance for claim fee.");
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_WALLET,
      lamports,
    })
  );

  transaction.feePayer = wallet.publicKey;
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const signedTransaction = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());

  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${confirmation.value.err}`);
  }

  console.log("✅ Claim fee payment confirmed");
  return signature;
}
