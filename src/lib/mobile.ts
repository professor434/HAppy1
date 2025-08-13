// src/lib/mobile.ts
export type WalletChoice = "phantom" | "solflare";

export function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
}

export function isInWalletWebView() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Phantom|Solflare|Backpack/i.test(ua);
}

export function hasInjectedWallet() {
  if (typeof window === "undefined") return false;
  type Provider = { isPhantom?: boolean; isSolflare?: boolean };
  const w = window as typeof window & {
    solana?: Provider & { providers?: Provider[] };
    phantom?: { solana?: { isPhantom?: boolean } };
    solflare?: { isSolflare?: boolean };
  };
  const sol = w.solana;
  const providers = Array.isArray(sol?.providers) ? sol.providers : [];
  const hasPhantom =
    !!w.phantom?.solana?.isPhantom || !!sol?.isPhantom || providers.some((p) => p.isPhantom);
  const hasSolflare =
    !!w.solflare?.isSolflare || !!sol?.isSolflare || providers.some((p) => p.isSolflare);
  return Boolean(hasPhantom || hasSolflare);
}

const deepLinks = {
  phantom: (url: string) => `https://phantom.app/ul/browse?url=${encodeURIComponent(url)}`,
  solflare: (url: string) => `https://solflare.com/ul/v1/browse?url=${encodeURIComponent(url)}`,
} as const;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore (iOS private mode) */ }
}

const KEY = "preferredWallet";
export function getPreferredWallet(): WalletChoice {
  if (typeof localStorage === "undefined") return "phantom";
  const v = safeGet(KEY);
  return (v === "solflare" ? "solflare" : "phantom");
}
export function setPreferredWallet(w: WalletChoice) {
  if (typeof localStorage === "undefined") return;
  safeSet(KEY, w);
}

// Accepts 1 or 2 args (backward compatible)
export function openInWalletBrowser(url: string, wallet?: WalletChoice) {
  const choice = wallet ?? getPreferredWallet();
  const href = deepLinks[choice](url);
  if (typeof window !== "undefined") window.location.href = href;
}

export function walletStoreUrl(wallet: WalletChoice) {
  if (typeof navigator === "undefined") return "https://phantom.app/";
  const ua = navigator.userAgent || "";
  const isiOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (wallet === "phantom") {
    if (isiOS) return "https://apps.apple.com/app/phantom-crypto-wallet/id1598432977";
    if (isAndroid) return "https://play.google.com/store/apps/details?id=app.phantom&hl=en";
    return "https://phantom.app/";
  } else {
    if (isiOS) return "https://apps.apple.com/app/solflare-solana-wallet/id1580902717";
    if (isAndroid) return "https://play.google.com/store/apps/details?id=com.solflare.mobile";
    return "https://solflare.com/";
  }
}
