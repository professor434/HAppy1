// src/lib/api.ts
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
  total_paid_usdc?: number | null;
  total_paid_sol?: number | null;
  fee_paid_usdc?: number | null;
  fee_paid_sol?: number | null;
  price_usdc_each?: number;
  user_agent?: string;
};
export type WalletClaimStatus = { wallet: string; canClaim: boolean; total?: string };

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + url, {
    cache: "no-store",
    headers: { "cache-control": "no-cache", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const e = await res.json(); if (e?.error) msg = e.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const getCurrentTier = () => j<TierInfo>("/tiers");
export const getPresaleStatus = () => j<PresaleStatus>("/status");

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
}): Promise<PurchaseRecord | null> {
  const body = JSON.stringify(data);
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API_BASE + "/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "include",
      });
      if (r.ok) return (await r.json()) as PurchaseRecord;
    } catch {}
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}

export async function canClaimTokensBulk(wallets: string[]): Promise<Map<string, WalletClaimStatus>> {
  const out = await j<Array<{ wallet: string; canClaim: boolean; total?: string | number }>>("/can-claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallets }),
  });
  const map = new Map<string, WalletClaimStatus>();
  for (const r of out) {
    map.set(r.wallet, { wallet: r.wallet, canClaim: r.canClaim, total: r.total != null ? String(r.total) : undefined });
  }
  return map;
}

export function recordClaim(data: { wallet: string; transaction_signature: string }) {
  return j<{ success: true }>("/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
