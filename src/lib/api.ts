// src/lib/api.ts

// ======================================================
// ΠΑΝΤΑ Railway (χωρίς env για να μη γυρνάει σε localhost)
// ======================================================
export const API_BASE_URL = "https://happy-pennis.up.railway.app";

// Για γρήγορη διάγνωση στο browser console
// @ts-ignore
if (typeof window !== "undefined") (window as any).__API_BASE__ = API_BASE_URL;

// ======================================================
// Helpers
// ======================================================
async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    mode: "cors",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    let msg = `API ${res.status} ${res.statusText} @ ${path}`;
    try {
      const err = await res.json();
      if (err?.error) msg = err.error;
    } catch {
      try { msg = await res.text(); } catch {}
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// Αν μια κλήση γυρίσει 404/405, δοκίμασε εναλλακτικό endpoint
async function tryAlt<T>(fn: () => Promise<T>, alt: () => Promise<T>) {
  try {
    return await fn();
  } catch (e: any) {
    const s = String(e?.message || "");
    if (/(404|405)/.test(s)) return await alt();
    throw e;
  }
}

// ======================================================
// Types
// ======================================================
export type TierInfo = {
  tier: number;
  price_usdc: number;
  max_tokens: number;
  duration_days?: number | null;
};

export type PresaleStatus = {
  raised: number;
  currentTier: TierInfo;
  totalPurchases: number;
  totalClaims: number;
  spl_address: string;
  fee_wallet: string;
  presaleEnded?: boolean;
};

export type PurchaseRecord = {
  id: number;
  wallet: string;
  token: "SOL" | "USDC";
  amount: number;
  tier: number;
  transaction_signature: string;
  timestamp: string;
  claimed: boolean;
  total_paid_usdc?: number;
  total_paid_sol?: number;
  fee_paid_usdc?: number;
  fee_paid_sol?: number;
  price_usdc_each?: number;
};

export type WalletClaimStatus = {
  wallet: string;
  canClaim: boolean;
  total?: string;
};

// ======================================================
// API calls
// ======================================================

// Τρέχον tier από /tiers, fallback στο /tiers/1 για παλιότερες εκδόσεις.
export async function getCurrentTier(): Promise<TierInfo> {
  return tryAlt<TierInfo>(
    () => j<TierInfo>("/tiers"),
    () => j<TierInfo>("/tiers/1")
  );
}

export const getPresaleStatus = () => j<PresaleStatus>("/status");

// Batch έλεγχος. Για ένα wallet δοκίμασε πρώτα GET /can-claim/:wallet.
export async function canClaimTokensBulk(wallets: string[]) {
  if (wallets.length === 1) {
    const w = wallets[0];
    const one = await tryAlt<{ wallet: string; canClaim: boolean; total?: string | number }>(
      () => j(`/can-claim/${encodeURIComponent(w)}`),
      () =>
        j("/can-claim", {
          method: "POST",
          body: JSON.stringify({ wallets: [w] }),
        }).then((arr: any[]) => (arr && arr[0]) || { wallet: w, canClai
