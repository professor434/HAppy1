// src/lib/api.ts

// ---- Base URL (πάντα Railway) ----
const RAW =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  "https://happy-pennis.up.railway.app";
export const API_BASE_URL = String(RAW).replace(/\/+$/, "");

// ---- helpers ----
async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    mode: "cors",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const e = await res.json();
      if (e?.error) msg = e.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ---- types ----
export type TierInfo = { tier: number; price_usdc: number; max_tokens: number; duration_days?: number | null };
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

// ---- API calls ----
export const getCurrentTier = () => j<TierInfo>("/tiers");
export const getPresaleStatus = () => j<PresaleStatus>("/status");

export async function canClaimTokensBulk(wallets: string[]) {
  const out = await j<Array<{ wallet: string; canClaim: boolean; total?: string | number }>>(
    "/can-claim",
    { method: "POST", body: JSON.stringify({ wallets }) }
  );
  const map = new Map<string, WalletClaimStatus>();
  for (const r of out) {
    map.set(r.wallet, {
      wallet: r.wallet,
      canClaim: r.canClaim,
      total: r.total != null ? String(r.total) : undefined,
    });
  }
  return map;
}

export function recordPurchase(data: {
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

// CSV export (ανοίγει νέο tab)
export function downloadSnapshotCSV(): void {
  window.open(`${API_BASE_URL}/export`, "_blank");
}
