import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection, PublicKey, SystemProgram, TransactionInstruction
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction, getAssociatedTokenAddress
} from "@solana/spl-token";

import { j } from "@/lib/api";
import {
  FEE_WALLET, TREASURY_WALLET, USDC_MINT_ADDRESS,
  VITE_SOLANA_RPC_URL, COMMITMENT
} from "@/lib/env";
import { buildV0Tx, signSendAndConfirm } from "@/lib/solana";

// 0.4% fee (0.004). Αν αλλάξει, το αλλάζεις εδώ.
const FEE_RATE = 0.004;

const solToLamports  = (sol: number)  => Math.round(sol * 1_000_000_000);
const usdcToUnits    = (u: number)    => Math.round(u   * 1_000_000);

export type PresaleState = { loading: boolean; lastSig?: string; error?: string; };
export type PresaleActions = {
  buyWithSOL:  (p: { solAmount: number; tokens: number;  price_usdc_each: number }) => Promise<string>;
  buyWithUSDC: (p: { usdcAmount: number; tokens: number; price_usdc_each: number }) => Promise<string>;
  claim:       (p: { tokens: number }) => Promise<string>;
};

export function usePresale(): [PresaleState, PresaleActions] {
  const { publicKey, wallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [lastSig, setLastSig] = useState<string | undefined>();
  const [error, setError]     = useState<string | undefined>();

  const connection = useMemo(
    () => new Connection(VITE_SOLANA_RPC_URL, { commitment: COMMITMENT }),
    []
  );

  const guard = useCallback(() => {
    if (!wallet || !publicKey) throw new Error("Σύνδεσε wallet πρώτα.");
  }, [wallet, publicKey]);

  // Δύο μεταφορές σε SOL: net -> treasury, fee -> fee wallet
  const buildSOLPurchaseIxs = useCallback((from: PublicKey, lamportsTotal: number) => {
    const feeLamports = Math.max(Math.floor(lamportsTotal * FEE_RATE), 0);
    const netLamports = lamportsTotal - feeLamports;
    if (netLamports <= 0) throw new Error("Ποσό SOL πολύ μικρό μετά το fee.");

    const ixs: TransactionInstruction[] = [
      SystemProgram.transfer({ fromPubkey: from, toPubkey: TREASURY_WALLET, lamports: netLamports }),
    ];
    if (feeLamports > 0) {
      ixs.push(SystemProgram.transfer({ fromPubkey: from, toPubkey: FEE_WALLET, lamports: feeLamports }));
    }
    return { ixs, feeLamports, netLamports };
  }, []);

  // Δύο transferChecked για USDC: net -> treasury, fee -> fee wallet (decimals = 6)
  const buildUSDCPurchaseIxs = useCallback(async (from: PublicKey, usdcUnitsTotal: number) => {
    const feeUnits = Math.max(Math.floor(usdcUnitsTotal * FEE_RATE), 0);
    const netUnits = usdcUnitsTotal - feeUnits;
    if (netUnits <= 0) throw new Error("Ποσό USDC πολύ μικρό μετά το fee.");

    const fromAta     = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, from, false);
    const treasuryAta = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, TREASURY_WALLET, true);
    const feeAta      = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, FEE_WALLET, true);

    const ixs: TransactionInstruction[] = [
      createTransferCheckedInstruction(fromAta, USDC_MINT_ADDRESS, treasuryAta, from, netUnits, 6),
    ];
    if (feeUnits > 0) {
      ixs.push(createTransferCheckedInstruction(fromAta, USDC_MINT_ADDRESS, feeAta, from, feeUnits, 6));
    }
    return { ixs, feeUnits, netUnits };
  }, []);

  const buyWithSOL: PresaleActions["buyWithSOL"] = useCallback(async ({ solAmount, tokens, price_usdc_each }) => {
    setLoading(true); setError(undefined);
    try {
      guard();
      const lamportsTotal = solToLamports(solAmount);
      const { ixs, feeLamports, netLamports } = buildSOLPurchaseIxs(publicKey!, lamportsTotal);

      const _tx = await buildV0Tx(publicKey!, ixs, connection); // για το blockhash
      const sig = await signSendAndConfirm(wallet!, publicKey!, ixs);

      await j("/buy", {
        method: "POST",
        body: JSON.stringify({
          wallet: publicKey!.toBase58(),
          amount: tokens,
          token: "SOL",
          transaction_signature: sig,
          total_paid_sol: (netLamports + feeLamports) / 1_000_000_000,
          fee_paid_sol:   feeLamports / 1_000_000_000,
          price_usdc_each,
        }),
      });

      setLastSig(sig);
      return sig;
    } catch (e: any) { setError(e?.message ?? String(e)); throw e; }
    finally { setLoading(false); }
  }, [publicKey, wallet, connection, buildSOLPurchaseIxs, guard]);

  const buyWithUSDC: PresaleActions["buyWithUSDC"] = useCallback(async ({ usdcAmount, tokens, price_usdc_each }) => {
    setLoading(true); setError(undefined);
    try {
      guard();
      const units = usdcToUnits(usdcAmount);
      const { ixs, feeUnits, netUnits } = await buildUSDCPurchaseIxs(publicKey!, units);

      const _tx = await buildV0Tx(publicKey!, ixs, connection);
      const sig = await signSendAndConfirm(wallet!, publicKey!, ixs);

      await j("/buy", {
        method: "POST",
        body: JSON.stringify({
          wallet: publicKey!.toBase58(),
          amount: tokens,
          token: "USDC",
          transaction_signature: sig,
          total_paid_usdc: (netUnits + feeUnits) / 1_000_000,
          fee_paid_usdc:   feeUnits / 1_000_000,
          price_usdc_each,
        }),
      });

      setLastSig(sig);
      return sig;
    } catch (e: any) { setError(e?.message ?? String(e)); throw e; }
    finally { setLoading(false); }
  }, [publicKey, wallet, connection, buildUSDCPurchaseIxs, guard]);

  const claim: PresaleActions["claim"] = useCallback(async ({ tokens }) => {
    setLoading(true); setError(undefined);
    try {
      guard();
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
    } catch (e: any) { setError(e?.message ?? String(e)); throw e; }
    finally { setLoading(false); }
  }, [publicKey, guard]);

  return [{ loading, lastSig, error }, { buyWithSOL, buyWithUSDC, claim }];
}
