import { WalletAdapterProps } from '@solana/wallet-adapter-base';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionSignature,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

// === ✅ CONSTANTS ===
export const SPL_MINT_ADDRESS = new PublicKey('GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs'); // Happy Penis SPL mint
export const TREASURY_WALLET = new PublicKey('6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD'); // Εσύ το έχεις ήδη!
export const FEE_WALLET = new PublicKey('J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn'); // Για fees
export const USDC_MINT_ADDRESS = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Official USDC mint

// ✅ RPC endpoint
// Never fallback to api.mainnet-beta.solana.com; always use a dedicated provider.
export const SOLANA_RPC_URL =
  'https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2';
// or
// export const SOLANA_RPC_URL =
//   'https://solana-mainnet.g.alchemy.com/v2/<YOUR_KEY>';
// Reuse a single connection instance across the app.
export const connection = new Connection(SOLANA_RPC_URL);

export const BUY_FEE_PERCENTAGE = 0.1;
export const CLAIM_FEE_PERCENTAGE = 0.4;

// === 🧠 HELPERS ===
export const calculateFee = (amount: number, percentage: number): number =>
  amount * (percentage / 100);

// Re-sign and resend if the blockhash has expired
async function signAndSendTransaction(
  transaction: Transaction,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  transaction.feePayer = wallet.publicKey!;

  let latestBlockhash = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = latestBlockhash.blockhash;

  let signed = await wallet.signTransaction!(transaction);
  try {
    const signature = await connection.sendRawTransaction(signed.serialize());
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    return signature;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('blockhash not found')) {
      latestBlockhash = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = latestBlockhash.blockhash;
      signed = await wallet.signTransaction!(transaction);

      const signature = await connection.sendRawTransaction(signed.serialize());
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      return signature;
    }

    throw error;
  }
}

// === 💸 SOL PAYMENT ===
export async function executeSOLPayment(
  amount: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not properly connected');
  }

  const feeAmount = calculateFee(amount, BUY_FEE_PERCENTAGE);
  const mainAmount = amount - feeAmount;
  const lamportsToSend =
    Math.floor(mainAmount * LAMPORTS_PER_SOL) +
    Math.floor(feeAmount * LAMPORTS_PER_SOL);

  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < lamportsToSend + 5000) {
    throw new Error('Insufficient SOL balance.');
  }

  const transaction = new Transaction();
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: TREASURY_WALLET,
      lamports: Math.floor(mainAmount * LAMPORTS_PER_SOL),
    }),
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_WALLET,
      lamports: Math.floor(feeAmount * LAMPORTS_PER_SOL),
    })
  );
  return signAndSendTransaction(transaction, wallet);
}

// === 💰 USDC PAYMENT ===
export async function executeUSDCPayment(
  amount: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not properly connected');
  }

  const fromTokenAccount = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, wallet.publicKey);

  try {
    await getAccount(connection, fromTokenAccount);
  } catch {
    throw new Error('No USDC token account. Please fund your wallet with USDC.');
  }

  const feeAmount = calculateFee(amount, BUY_FEE_PERCENTAGE);
  const mainAmount = amount - feeAmount;

  const adjustedMain = Math.floor(mainAmount * 10 ** 6);
  const adjustedFee = Math.floor(feeAmount * 10 ** 6);

  const toMainTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_ADDRESS,
    TREASURY_WALLET,
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
        TREASURY_WALLET,
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
    createTransferInstruction(fromTokenAccount, toMainTokenAccount, wallet.publicKey, adjustedMain),
    createTransferInstruction(fromTokenAccount, toFeeTokenAccount, wallet.publicKey, adjustedFee)
  );
  return signAndSendTransaction(transaction, wallet);
}

// === ✅ CLAIM FEE ===
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
    throw new Error('Insufficient balance for claim fee.');
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_WALLET,
      lamports,
    })
  );
  return signAndSendTransaction(transaction, wallet);
}

// === 🔑 PUBLIC KEY FORMATTER ===
export function formatPublicKey(key: string | PublicKey) {
  if (!key) return '';
  const str = typeof key === 'string' ? key : key.toBase58();
  return `${str.slice(0, 6)}...${str.slice(-6)}`;
}
