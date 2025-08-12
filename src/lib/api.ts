// src/lib/api.ts

// ======================================================
// Base URL του backend (Railway) με ασφαλές fallback
// ======================================================
const RAW =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  "https://happy-pennis.up.railway.app";

// Κόβουμε τυχόν τελικές κάθετους
export const API_BASE_URL = String(RAW).replace(/\/+$/, "");

// Για εύκολη διάγνωση στο browser console
// @ts-ignore
if (typeof window !== "undefined") (window as any).__API_BASE__ = API_BASE_URL;

// ======================================================
/* Helpers */
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
      try {
        msg = await res.text();
      } catch {}
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

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

export type PaymentToken = "SOL" | "USDC";

export type PurchaseRecord = {
  id: number;
  wallet: string;
  token: PaymentToken;
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

/** Όλες οι βαθμίδες presale (array).
 *  Δουλεύει με /tiers -> array | object | {tiers:[...]} και fallback /tiers/all
 */
export async function getPresaleTiers(): Promise<TierInfo[]> {
  const parse = (v: any): TierInfo[] => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.tiers)) return v.tiers;
    if (v && typeof v.tier === "number") return [v];
    throw new Error("Malformed /tiers response");
  };

  try {
    const v = await j<any>("/tiers");
    return parse(v);
  } catch {
    const v = await j<any>("/tiers/all");
    return parse(v);
  }
}

/** Τρέχον tier με ευέλικτο fallback:
 *  1) /status.currentTier
 *  2) /tiers/current
 *  3) /tiers (παίρνουμε το πρώτο αν είναι array ή το object)
 */
export async function getCurrentTier(): Promise<TierInfo> {
  try {
    const s = await j<PresaleStatus>("/status");
    if (s?.currentTier) return s.currentTier;
  } catch {}

  try {
    return await j<TierInfo>("/tiers/current");
  } catch {}

  const v = await j<any>("/tiers");
  if (Array.isArray(v) && v.length) return v[0];
  if (v && Array.isArray(v.tiers) && v.tiers.length) return v.tiers[0];
  if (v && typeof v.tier === "number") return v as TierInfo;

  throw new Error("No tier info available");
}

export const getPresaleStatus = () => j<PresaleStatus>("/status");

// Batch έλεγχος (POST /can-claim). Για μονό wallet κάνουμε και fallback στο GET /can-claim/:wallet.
export async function canClaimTokensBulk(wallets: string[]) {
  if (wallets.length === 1) {
    const w = wallets[0];
    const one = await tryAlt<{ wallet: string; canClaim: boolean; total?: string | number }>(
      () => j(`/can-claim/${encodeURIComponent(w)}`),
      () =>
        j("/can-claim", {
          method: "POST",
          body: JSON.stringify({ wallets: [w] }),
        }).then((arr: any[]) => (arr && arr[0]) || { wallet: w, canClaim: false })
    );

    const map = new Map<string, WalletClaimStatus>();
    map.set(w, {
      wallet: w,
      canClaim: !!one.canClaim,
      total: one.total != null ? String(one.total) : undefined,
    });
    return map;
  }

  const out = await j<Array<{ wallet: string; canClaim: boolean; total?: string | number }>>(
    "/can-claim",
    { method: "POST", body: JSON.stringify({ wallets }) }
  );

  const map = new Map<string, WalletClaimStatus>();
  for (const r of out) {
    map.set(r.wallet, {
      wallet: r.wallet,
      canClaim: !!r.canClaim,
      total: r.total != null ? String(r.total) : undefined,
    });
  }
  return map;
}

export function recordPurchase(data: {
  wallet: string;
  amount: number;
  token: PaymentToken;
  transaction_signature: string;
  total_paid_usdc?: number;
  total_paid_sol?: number;
  fee_paid_usdc?: number;
  fee_paid_sol?: number;
  price_usdc_each?: number;
}) {
  return j<PurchaseRecord>("/buy", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function recordClaim(data: { wallet: string; transaction_signature: string }) {
  return j<{ success: true }>("/claim", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export const getSnapshot = () => j<PurchaseRecord[]>("/snapshot");

// Άνοιγμα CSV σε νέο tab
export function downloadSnapshotCSV(): void {
  window.open(`${API_BASE_URL}/export`, "_blank");
}
