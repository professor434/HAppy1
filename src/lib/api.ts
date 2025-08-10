// src/lib/api.ts
export type TierInfo = { tier: number; price_usdc: number; max_tokens: number };
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
  id: number; wallet: string; token: "SOL" | "USDC"; amount: number; tier: number;
  transaction_signature: string; timestamp: string; claimed: boolean;
  total_paid_usdc?: number; total_paid_sol?: number;
  fee_paid_usdc?: number;   fee_paid_sol?: number;
  price_usdc_each?: number;
};

export type WalletClaimStatus = { wallet: string; canClaim: boolean; total?: string };

// -------------------------------------------------

const API_BASE =
  ((import.meta as unknown) as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

const j = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(API_BASE + url, {
    cache: "no-store",
    headers: { "cache-control": "no-cache", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const e = await res.json(); if (e?.error) msg = e.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
};

// -------------------------------------------------

export const getCurrentTier = () => j<TierInfo>("/tiers");

export const getPresaleStatus = () => j<PresaleStatus>("/status");

// Ενιαία καταγραφή αγοράς
export async function recordPurchase(data: {
  wallet: string;
  amount: number;
  token: "SOL" | "USDC";
  transaction_signature: string;
  total_paid_usdc?: number;
  total_paid_sol?: number;
  fee_paid_usdc?: number;
  fee_paid_sol?: number;
  price_usdc_each?: number;
}) {
  return j<PurchaseRecord>("/buy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function canClaimTokensBulk(wallets: string[]) {
  const out = await j<Array<{ wallet: string; canClaim: boolean; total?: string | number }>>(
    "/can-claim",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallets }) }
  );
  // κανονικοποίηση τύπων: πάντα string
  const map = new Map<string, WalletClaimStatus>();
  for (const r of out) {
    map.set(r.wallet, { wallet: r.wallet, canClaim: r.canClaim, total: r.total != null ? String(r.total) : undefined });
  }
  return map;
}

export const canClaimTokens = (wallet: string) =>
  j<{ canClaim: boolean; total?: string }>(`/can-claim/${wallet}`);

export async function recordClaim(data: { wallet: string; transaction_signature: string }) {
  return j<{ success: true }>("/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// Admin helpers (αν τα χρησιμοποιείς)
export const getSnapshot = (key: string) => j<PurchaseRecord[]>(`/snapshot?key=${encodeURIComponent(key)}`);
export async function downloadSnapshotCSV(key: string) {
  const res = await fetch(API_BASE + `/export?key=${encodeURIComponent(key)}`, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "presale_snapshot.csv"; a.click();
  URL.revokeObjectURL(url);
}
