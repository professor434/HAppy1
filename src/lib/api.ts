// src/lib/api.ts

import { PublicKey } from "@solana/web3.js";

// Base URL (Railway) με δυνατότητα override από Vercel env
const RAW =
  (import.meta as { env?: { VITE_API_BASE_URL?: string } })?.env?.VITE_API_BASE_URL ||
  "https://happy-pennis.up.railway.app";
export const API_BASE_URL = String(RAW).replace(/\/+$/, "");

// για debug στο browser
if (typeof window !== "undefined") {
  (window as unknown as { __API_BASE__?: string }).__API_BASE__ = API_BASE_URL;
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    mode: "cors",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `API ${res.status} ${res.statusText} @ ${path}`;
    try {
      const e = await res.json();
      if (e?.error) msg = e.error;
    } catch {
      try {
        msg = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

async function tryAlt<T>(fn: () => Promise<T>, alt: () => Promise<T>) {
  try {
    return await fn();
  } catch (e: unknown) {
    const s = String((e as { message?: string })?.message || "");
    if (/(404|405)/.test(s)) return await alt();
    throw e;
  }
}

// ---- types ----
export type TierInfo = { tier: number; price_usdc: number; max_tokens: number; duration_days?: number | null };
export type PaymentToken = "SOL" | "USDC";
export type PresaleStatus = {
  raised: number;
  currentTier: TierInfo;
  totalPurchases: number;
  totalClaims: number;
  spl_address: PublicKey;
  fee_wallet: string;
  presaleEnded?: boolean;
};

type PresaleStatusRaw = Omit<PresaleStatus, "spl_address"> & {
  spl_address: string;
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
export async function getCurrentTier(): Promise<TierInfo> {
  const status = await getPresaleStatus();
  return status.currentTier;
}
export const getPresaleStatus = async (): Promise<PresaleStatus> => {
  const raw = await j<PresaleStatusRaw>("/status");
  return { ...raw, spl_address: new PublicKey(raw.spl_address) };
};
export const getPresaleTiers = () => j<TierInfo[]>("/tiers");

export async function canClaimTokensBulk(wallets: string[]) {
  if (wallets.length === 1) {
    const w = wallets[0];
    const one = await tryAlt<{ wallet: string; canClaim: boolean; total?: string | number }>(
      () => j(`/can-claim/${encodeURIComponent(w)}`),
      () =>
        j("/can-claim", {
          method: "POST",
          body: JSON.stringify({ wallets: [w] }),
        }).then((arr: { wallet: string; canClaim: boolean; total?: string | number }[]) =>
          (arr && arr[0]) || { wallet: w, canClaim: false }
        )
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
  token: "SOL" | "USDC";
  transaction_signature: string;
  total_paid_usdc?: number;
  total_paid_sol?: number;
  fee_paid_usdc?: number;
  fee_paid_sol?: number;
  price_usdc_each?: number;
}) {
  return j<PurchaseRecord>("/buy", { method: "POST", body: JSON.stringify(data) });
}

export function recordClaim(data: { wallet: string; transaction_signature: string }) {
  return j<{ success: true }>("/claim", { method: "POST", body: JSON.stringify(data) });
}

export const getSnapshot = () => j<PurchaseRecord[]>("/snapshot");

export function downloadSnapshotCSV(): void {
  window.open(`${API_BASE_URL}/export`, "_blank");
}
