import { useCallback, useMemo } from 'react';
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
  TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import bs58 from 'bs58';

// Define constants - Updated with the correct addresses
export const SPL_MINT_ADDRESS = new PublicKey('6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD');
export const FEE_WALLET = new PublicKey('J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn');
export const USDC_MINT_ADDRESS = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Export RPC URL for Solana connection - using devnet for testing
export const SOLANA_RPC_URL = clusterApiUrl('devnet');

// Fee settings
export const BUY_FEE_PERCENTAGE = 0.1; // 0.1% fee on buy
export const CLAIM_FEE_PERCENTAGE = 0.4; // 0.4% fee on claim

// Network connection - using the same RPC URL as defined above
export const connection = new Connection(SOLANA_RPC_URL);

/**
 * Format a public key for display (first 4 chars...last 4 chars)
 */
export const formatPublicKey = (key: string | PublicKey): string => {
  const keyStr = typeof key === 'string' ? key : key.toString();
  return `${keyStr.slice(0, 4)}...${keyStr.slice(-4)}`;
};

/**
 * Calculate fee amount based on the input amount and fee percentage
 */
export const calculateFee = (amount: number, feePercentage: number): number => {
  return amount * (feePercentage / 100);
};

/**
 * Execute a SOL payment transaction
 */
export async function executeSOLPayment(
  amount: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  console.log("Starting SOL payment execution", { amount });
  
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      console.error("Wallet connection issue:", { 
        publicKeyExists: !!wallet.publicKey, 
        signTransactionExists: !!wallet.signTransaction 
      });
      throw new Error('Wallet not properly connected');
    }

    // Calculate main payment and fee
    const feeAmount = calculateFee(amount, BUY_FEE_PERCENTAGE);
    const mainAmount = amount - feeAmount;
    
    console.log("Payment amounts:", { mainAmount, feeAmount, total: amount });
    
    // Create a transaction with two transfers: main payment to SPL_MINT_ADDRESS and fee to FEE_WALLET
    const transaction = new Transaction();
    
    // Main payment
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: SPL_MINT_ADDRESS,
        lamports: Math.floor(mainAmount * LAMPORTS_PER_SOL),
      })
    );
    
    // Fee payment
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: FEE_WALLET,
        lamports: Math.floor(feeAmount * LAMPORTS_PER_SOL),
      })
    );

    // Set recent blockhash and fee payer
    transaction.feePayer = wallet.publicKey;
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latestBlockhash.blockhash;
    
    console.log("Transaction prepared with blockhash:", latestBlockhash.blockhash);

    try {
      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      console.log("Transaction signed successfully");
      
      // Send the transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      console.log("Transaction sent with signature:", signature);
      
      // Wait for confirmation
      console.log("Waiting for transaction confirmation...");
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        console.error("Transaction error:", confirmation.value.err);
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log("SOL payment confirmed successfully");
      return signature;
    } catch (signError) {
      console.error("Transaction signing/sending error:", signError);
      throw new Error(signError instanceof Error ? 
        `Transaction failed: ${signError.message}` : 
        'Failed to sign or send transaction');
    }
  } catch (error: unknown) {
    console.error('SOL payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send SOL payment';
    throw new Error(errorMessage);
  }
}

/**
 * Execute a USDC payment transaction
 */
export async function executeUSDCPayment(
  amount: number, 
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  console.log("Starting USDC payment execution", { amount });
  
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      console.error("Wallet connection issue:", { 
        publicKeyExists: !!wallet.publicKey, 
        signTransactionExists: !!wallet.signTransaction 
      });
      throw new Error('Wallet not properly connected');
    }

    // Get the sender's token account
    const fromTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT_ADDRESS,
      wallet.publicKey
    );
    
    console.log("Sender token account:", fromTokenAccount.toString());

    try {
      // Check if the sender's token account exists
      await getAccount(connection, fromTokenAccount);
      console.log("Sender's USDC token account exists");
    } catch (error) {
      console.error("Token account error:", error);
      throw new Error('You don\'t have a USDC token account. Please add USDC tokens to your wallet first.');
    }

    // USDC has 6 decimals
    const tokenDecimals = 6;
    
    // Calculate main payment and fee
    const feeAmount = calculateFee(amount, BUY_FEE_PERCENTAGE);
    const mainAmount = amount - feeAmount;
    
    // Convert to token units
    const adjustedMainAmount = Math.floor(mainAmount * Math.pow(10, tokenDecimals));
    const adjustedFeeAmount = Math.floor(feeAmount * Math.pow(10, tokenDecimals));
    
    console.log("Payment amounts:", { 
      mainAmount, feeAmount, total: amount,
      adjustedMainAmount, adjustedFeeAmount
    });

    // Get the SPL_MINT_ADDRESS token account
    const toMainTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT_ADDRESS,
      SPL_MINT_ADDRESS
    );
    
    // Get the FEE_WALLET token account
    const toFeeTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT_ADDRESS,
      FEE_WALLET
    );
    
    console.log("Recipient token accounts:", {
      main: toMainTokenAccount.toString(),
      fee: toFeeTokenAccount.toString()
    });

    // Create a transaction with two transfers
    const transaction = new Transaction();
    
    // Main payment to SPL_MINT_ADDRESS
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toMainTokenAccount,
        wallet.publicKey,
        adjustedMainAmount
      )
    );
    
    // Fee payment to FEE_WALLET
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toFeeTokenAccount,
        wallet.publicKey,
        adjustedFeeAmount
      )
    );
    
    // Set recent blockhash and fee payer
    transaction.feePayer = wallet.publicKey;
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latestBlockhash.blockhash;
    
    console.log("Transaction prepared with blockhash:", latestBlockhash.blockhash);

    try {
      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      console.log("Transaction signed successfully");
      
      // Send the transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      console.log("Transaction sent with signature:", signature);
      
      // Wait for confirmation
      console.log("Waiting for transaction confirmation...");
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        console.error("Transaction error:", confirmation.value.err);
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log("USDC payment confirmed successfully");
      return signature;
    } catch (signError) {
      console.error("Transaction signing/sending error:", signError);
      throw new Error(signError instanceof Error ? 
        `Transaction failed: ${signError.message}` : 
        'Failed to sign or send transaction');
    }
  } catch (error: unknown) {
    console.error('USDC payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send USDC payment';
    throw new Error(errorMessage);
  }
}

/**
 * Execute the claim fee payment (0.4% of claimed tokens)
 * This function should be called when a user claims their tokens
 */
export async function executeClaimFeePayment(
  tokenAmount: number,
  wallet: Pick<WalletAdapterProps, 'publicKey' | 'signTransaction'>
): Promise<TransactionSignature> {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    // Calculate fee amount (0.4% of claimed tokens)
    const feeAmount = calculateFee(tokenAmount, CLAIM_FEE_PERCENTAGE);
    const feeInSol = 0.001; // Small SOL fee for the transaction
    
    console.log("Claim fee payment:", { tokenAmount, feePercentage: CLAIM_FEE_PERCENTAGE, feeAmount, feeInSol });

    // Create a transaction to pay the claim fee
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: FEE_WALLET,
        lamports: Math.floor(feeInSol * LAMPORTS_PER_SOL),
      })
    );

    // Set recent blockhash and fee payer
    transaction.feePayer = wallet.publicKey;
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latestBlockhash.blockhash;

    try {
      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send the transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Wait for confirmation
      console.log("Waiting for claim fee transaction confirmation...");
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        console.error("Claim fee transaction error:", confirmation.value.err);
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log("Claim fee payment confirmed successfully");
      return signature;
    } catch (signError) {
      console.error("Transaction signing/sending error:", signError);
      throw new Error(signError instanceof Error ? 
        `Transaction failed: ${signError.message}` : 
        'Failed to sign or send transaction');
    }
  } catch (error: unknown) {
    console.error('Claim fee payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to pay claim fee';
    throw new Error(errorMessage);
  }
}