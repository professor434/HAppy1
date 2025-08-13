// src/hooks/use-presale.ts
import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import { j } from "@/lib/api"; // helper για backend calls
import {
  FEE_WALLET,
  TREASURY_WALLET,
  USDC_MINT_ADDRESS,
  VITE_SOLANA_RPC_URL,
  COMMITMENT,
} from "@/lib/env";
import { buildV0Tx, signSendAndConfirm } from "@/lib/solana";

/** 0.4% fee (π.004). Άφησέ το εδώ ώστε αν αλλάξει, να αλλάζει σε ένα σημείο. */
const FEE_RATE = 0.004;

/** Βοηθητικό: lamports από SOL */
const solToLamports = (sol: number) => Math.round(sol * 1_000_000_000);

/** Βοηθητικό: USDC σε “μικρές μονάδες” (6 δεκαδικά) */
const usdcToUnits = (usdc: number) => Math.round(usdc * 1_000_000);

/** State που επιστρέφει το hook */
export type PresaleState = {
  loading: boolean;
  lastSig?: string;
  error?: string;
};

/** Πακέτο ενεργειών που εκθέτει το hook */
export type PresaleActions = {
  /** Αγορά με SOL: δίνεις ποσό σε SOL & πόσα PENIS tokens αντιστοιχούν στην τιμή */
  buyWithSOL: (params: { solAmount: number; tokens: number; price_usdc_each: number }) => Promise<string>;
  /** Αγορά με USDC: δίνεις ποσό σε USDC & πόσα PENIS tokens */
  buyWithUSDC: (params: { usdcAmount: number; tokens: number; price_usdc_each: number }) => Promise<string>;
  /** Κλείδωμα claim στο backend (αν έχεις on-chain claim, πρόσθεσε ixs αναλόγως) */
  claim: (params: { tokens: number }) => Promise<string>;
};

export function usePresale(): [PresaleState, PresaleActions] {
  const { publicKey, wallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [lastSig, setLastSig] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const connection = useMemo(
    () => new Connection(VITE_SOLANA_RPC_URL, { commitment: COMMITMENT }),
    []
  );

  const guard = useCallback(() => {
    if (!wallet || !publicKey) throw new Error("Σύνδεσε wallet πρώτα.");
  }, [wallet, publicKey]);

  /** Χτίζουμε δύο μεταφορές: fee → FEE_WALLET και καθαρό → TREASURY_WALLET */
  const buildSOLPurchaseIxs = useCallback(
    (from: PublicKey, lamportsTotal: number) => {
      const feeLamports = Math.max(Math.floor(lamportsTotal * FEE_RATE), 0);
      const netLamports = lamportsTotal - feeLamports;

      if (netLamports <= 0) throw new Error("Ποσό SOL πολύ μικρό μετά το fee.");

      const ixs: TransactionInstruction[] = [
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: TREASURY_WALLET,
          lamports: netLamports,
        }),
      ];

      if (feeLamports > 0) {
        ixs.push(
          SystemProgram.transfer({
            fromPubkey: from,
            toPubkey: FEE_WALLET,
            lamports: feeLamports,
          })
        );
      }
      return { ixs, feeLamports, netLamports };
    },
    []
  );

  /** Μεταφορά USDC: φτιάχνει ATA αν χρειάζεται (μόνο για source) και κάνει δύο transferChecked */
  const buildUSDCPurchaseIxs = useCallback(
    async (from: PublicKey, usdcUnitsTotal: number) => {
      const feeUnits = Math.max(Math.floor(usdcUnitsTotal * FEE_RATE), 0);
      const netUnits = usdcUnitsTotal - feeUnits;
      if (netUnits <= 0) throw new Error("Ποσό USDC πολύ μικρό μετά το fee.");

      const fromAta = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, from, false);
      const treasuryAta = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, TREASURY_WALLET, true);
      const feeAta = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, FEE_WALLET, true);

      const ixs: TransactionInstruction[] = [];

      // ΜΟΝΟ αν δεν υπάρχει το from ATA, ο χρήστης δεν έχει καθόλου USDC — τότε θα αποτύχει έτσι κι αλλιώς.
      // Εδώ ΔΕΝ δημιουργούμε ATA για recipient (treasury/fee) γιατί είναι γνωστά wallets και πρέπει ήδη να τα έχουν.
      // Αν θέλεις να τα δημιουργείς αυτόματα, πρέπει να καλέσεις createAssociatedTokenAccountInstruction.

      ixs.push(
        createTransferCheckedInstruction(
          fromAta,
          USDC_MINT_ADDRESS,
          treasuryAta,
          from,
          netUnits,
          6 // USDC decimals
        )
      );
      if (feeUnits > 0) {
        ixs.push(
          createTransferCheckedInstruction(
            fromAta,
            USDC_MINT_ADDRESS,
            feeAta,
            from,
            feeUnits,
            6
          )
        );
      }

      return { ixs, feeUnits, netUnits };
    },
    []
  );

  /** Αγορά με SOL */
  const buyWithSOL = useCallback<PresaleActions["buyWithSOL"]>(async ({ solAmount, tokens, price_usdc_each }) => {
    setLoading(true); setError(undefined);
    try {
      guard();
      const lamportsTotal = solToLamports(solAmount);
      const { ixs, feeLamports, netLamports } = buildSOLPurchaseIxs(publicKey!, lamportsTotal);

      const tx = await buildV0Tx(publicKey!, ixs, connection);
      const sig = await signSendAndConfirm(wallet!, publicKey!, ixs); // mobile-friendly

      // Καταγραφή στο backend (όπως το backend/server.js σου)
      await j("/buy", {
        method: "POST",
        body: JSON.stringify({
          wallet: publicKey!.toBase58(),
          amount: tokens,                // πόσα PENIS αγόρασε
          token: "SOL",
          transaction_signature: sig,
          total_paid_sol: (netLamports + feeLamports) / 1_000_000_000,
          fee_paid_sol: feeLamports / 1_000_000_000,
          price_usdc_each,
        }),
      });

      setLastSig(sig);
      return sig;
    } catch (e: any) {
      setError(e?.message ?? String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, connection, buildSOLPurchaseIxs, guard]);

  /** Αγορά με USDC */
  const buyWithUSDC = useCallback<PresaleActions["buyWithUSDC"]>(async ({ usdcAmount, tokens, price_usdc_each }) => {
    setLoading(true); setError(undefined);
    try {
      guard();
      const units = usdcToUnits(usdcAmount);
      const { ixs, feeUnits, netUnits } = await buildUSDCPurchaseIxs(publicKey!, units);

      const tx = await buildV0Tx(publicKey!, ixs, connection);
      const sig = await signSendAndConfirm(wallet!, publicKey!, ixs);

      await j("/buy", {
        method: "POST",
        body: JSON.stringify({
          wallet: publicKey!.toBase58(),
          amount: tokens,
          token: "USDC",
          transaction_signature: sig,
          total_paid_usdc: (netUnits + feeUnits) / 1_000_000,
          fee_paid_usdc: feeUnits / 1_000_000,
          price_usdc_each,
        }),
      });

      setLastSig(sig);
      return sig;
    } catch (e: any) {
      setError(e?.message ?? String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, connection, buildUSDCPurchaseIxs, guard]);

  /** Claim: backend-only καταγραφή (αν αργότερα βάλεις on-chain claim, πρόσθεσε ixs εδώ) */
  const claim = useCallback<PresaleActions["claim"]>(async ({ tokens }) => {
    setLoading(true); setError(undefined);
    try {
      guard();
      // Αν βάλεις on-chain claim, εδώ χτίζεις ixs και στέλνεις όπως στα buy.*
      // Για τώρα, μόνο backend log ώστε να μη σπάσει η ροή σου:
      const fakeSig = `claim_${Date.now()}`;
      await j("/claim", {
        method: "POST",
        body: JSON.stringify({
          wallet: publicKey!.toBase58(),
          transaction_signature: fakeSig,
          tokens,
        }),
      });
      setLastSig(fakeSig);
      return fakeSig;
    } catch (e: any) {
      setError(e?.message ?? String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [publicKey, guard]);

  return [
    { loading, lastSig, error },
    { buyWithSOL, buyWithUSDC, claim },
  ];
}
