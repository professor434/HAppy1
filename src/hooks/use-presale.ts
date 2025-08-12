import { useState, useEffect, useRef, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { useToast } from "@/components/ui/use-toast";
import {
  executeSOLPayment,
  executeUSDCPayment,
  executeClaimFeePayment,
  BUY_FEE_PERCENTAGE,
} from "@/lib/solana";
import {
  recordPurchase,
  canClaimTokensBulk,
  recordClaim,
  getPresaleStatus,
  type TierInfo,
} from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";

type PaymentToken = "SOL" | "USDC";

const SOL_TO_USDC_RATE = 170;
const PROD_URL = (import.meta.env.VITE_PROD_URL as string) || "https://happypennisofficialpresale.vercel.app/";

export function usePresale() {
  const { toast: uiToast } = useToast();
  const { publicKey, connected, signTransaction, sendTransaction, connect } = useWallet();
  const isMobile = useIsMobile();

  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [currentTier, setCurrentTier] = useState<TierInfo | null>(null);
  const [totalRaised, setTotalRaised] = useState(0);
  const [amount, setAmount] = useState("");
  const [paymentToken, setPaymentToken] = useState<PaymentToken>("SOL");
  const [isPending, setIsPending] = useState(false);
  const [presaleEnded, setPresaleEnded] = useState(false);
  const [claimableTokens, setClaimableTokens] = useState<null | { canClaim: boolean; total?: string }>(null);
  const [isClaimPending, setIsClaimPending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastWallet = useRef<string | null>(null);

  const hasInjected = () => {
    if (typeof window === "undefined") return false;
    const w = window as typeof window & { solana?: { isPhantom?: boolean }; solflare?: unknown };
    return w.solana?.isPhantom || w.solflare;
  };

  useEffect(() => {
    if (isMobile && hasInjected() && !connected) connect().catch(() => {});
  }, [connected, connect, isMobile]);

  useEffect(() => {
    if (connected) {
      const target = PROD_URL;
      if (typeof window !== "undefined" && window.location.href !== target) {
        window.location.href = target;
      }
    }
  }, [connected]);

  useEffect(() => {
    if (connected && publicKey) {
      const key = publicKey.toString();
      if (lastWallet.current !== key) {
        lastWallet.current = key;
        checkClaimStatus();
      }
    } else {
      setClaimableTokens(null);
      lastWallet.current = null;
    }
  }, [connected, publicKey]);

  useEffect(() => {
    fetchPresaleStatus();
  }, []);

  useEffect(() => {
    if (!tiers.length) return;
    let raisedSoFar = 0;
    for (const tier of tiers) {
      if (raisedSoFar + tier.max_tokens > totalRaised) {
        setCurrentTier(tier);
        break;
      }
      raisedSoFar += tier.max_tokens;
    }
  }, [totalRaised, tiers]);

  const fetchPresaleStatus = async () => {
    try {
      setIsCheckingStatus(true);
      setError(null);
      const status = await getPresaleStatus();
      if (status) {
        setTotalRaised(status.raised);
        setPresaleEnded(!!status.presaleEnded);
        setCurrentTier(status.currentTier);
        setTiers([status.currentTier]);
      }
    } catch (e) {
      console.error("status error:", e);
      const message = e instanceof Error ? e.message : "Failed to load presale data";
      setError(message);
      toast.error(message);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const checkClaimStatus = async () => {
    if (!publicKey || !connected) return;
    try {
      setIsCheckingStatus(true);
      const map = await canClaimTokensBulk([publicKey.toString()]);
      const info = map.get(publicKey.toString());
      setClaimableTokens(info ? { canClaim: info.canClaim, total: info.total } : null);
    } catch {
      toast.error("Failed to check claim status");
      setClaimableTokens(null);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const buyTokens = async () => {
    toast.info("Starting purchase process...");
    if (!connected) {
      try { await connect(); } catch { return; }
    }
    if (!publicKey) { toast.error("Wallet not connected"); return; }
    if (!amount || parseFloat(amount) <= 0 || !currentTier) { toast.error("Invalid amount"); return; }

    setIsPending(true);
    try {
      const penisAmount = parseFloat(amount);
      const totalPriceUSDC = penisAmount * currentTier.price_usdc;
      const feePct = BUY_FEE_PERCENTAGE / 100;
      let txSignature: string | null = null;
      let total_paid_usdc: number | null = null;
      let total_paid_sol: number | null = null;
      let fee_paid_usdc: number | null = null;
      let fee_paid_sol: number | null = null;

      if (paymentToken === "SOL" && publicKey && signTransaction) {
        const solAmount = totalPriceUSDC / SOL_TO_USDC_RATE;
        txSignature = await executeSOLPayment(solAmount, { publicKey, signTransaction, sendTransaction });
        total_paid_sol = +solAmount.toFixed(6);
        fee_paid_sol = +(solAmount * feePct).toFixed(6);
      } else if (paymentToken === "USDC" && publicKey && signTransaction) {
        txSignature = await executeUSDCPayment(totalPriceUSDC, { publicKey, signTransaction, sendTransaction });
        total_paid_usdc = +totalPriceUSDC.toFixed(6);
        fee_paid_usdc = +(totalPriceUSDC * feePct).toFixed(6);
      } else {
        toast.error("Invalid payment method or wallet not properly connected");
        throw new Error("payment method");
      }

      if (!txSignature) throw new Error("No transaction signature returned");
      (window as unknown as { lastTransactionSignature?: string }).lastTransactionSignature = txSignature;

      const rec = await recordPurchase({
        wallet: publicKey.toString(),
        amount: penisAmount,
        token: paymentToken,
        transaction_signature: txSignature,
        total_paid_usdc: total_paid_usdc ?? undefined,
        total_paid_sol: total_paid_sol ?? undefined,
        fee_paid_usdc: fee_paid_usdc ?? undefined,
        fee_paid_sol: fee_paid_sol ?? undefined,
        price_usdc_each: currentTier.price_usdc,
      });
      if (!rec) { toast.error("Purchase record failed. Try again."); return; }

      setTotalRaised((prev) => prev + penisAmount);
      setAmount("");
      checkClaimStatus();
      toast.success("Purchase completed successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Transaction failed");
    } finally {
      setIsPending(false);
    }
  };

  const claimTokens = async () => {
    if (!connected) {
      try { await connect(); } catch { return; }
    }
    if (!publicKey || !claimableTokens?.canClaim || !claimableTokens.total) return;
    setIsClaimPending(true);
    try {
      const tokenAmount = parseFloat(claimableTokens.total);
      const txSignature = await executeClaimFeePayment({ publicKey, signTransaction, sendTransaction });
      if (!txSignature) throw new Error("Claim fee payment failed");
      const resp = await recordClaim({ wallet: publicKey.toString(), transaction_signature: txSignature });
      if (!resp?.success) throw new Error("Failed to record claim on server");
      uiToast({ title: "Claim Successful!", description: `You claimed ${tokenAmount.toLocaleString()} PENIS tokens` });
      setClaimableTokens({ ...claimableTokens, canClaim: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : undefined;
      uiToast({ title: "Claim Failed", description: message || "Could not complete the claim.", variant: "destructive" });
    } finally {
      setIsClaimPending(false);
    }
  };

  const goalTokens = useMemo(() => tiers.reduce((s, t) => s + (t.max_tokens || 0), 0), [tiers]);
  const raisedPercentage = useMemo(() => (totalRaised / goalTokens) * 100, [totalRaised, goalTokens]);

  return {
    tiers,
    currentTier,
    totalRaised,
    amount,
    setAmount,
    paymentToken,
    setPaymentToken,
    isPending,
    presaleEnded,
    claimableTokens,
    isClaimPending,
    isCheckingStatus,
    buyTokens,
    claimTokens,
    connected,
    goalTokens,
    raisedPercentage,
    isMobile,
    error,
  };
}
