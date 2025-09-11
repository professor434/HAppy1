// src/lib/mobile.ts
export type WalletChoice = "phantom" | "solflare";

const isBrowser = typeof window !== "undefined";
const UA = isBrowser ? navigator.userAgent : "";

export function isMobileUA() {
  if (!isBrowser) return false;
  return /iPhone|iPad|iPod|Android/i.test(UA);
}

export function isInWalletWebView() {
  if (!isBrowser) return false;
  return /Phantom|Solflare|Backpack/i.test(UA);
}

export function hasInjectedWallet() {
  if (!isBrowser) return false;
  const w = window as any;
  const sol = w.solana;
  const hasPhantom =
    !!w?.phantom?.solana?.isPhantom ||
    !!sol?.isPhantom ||
    !!sol?.providers?.some?.((p: any) => p?.isPhantom);
  const hasSolflare =
    !!w?.solflare?.isSolflare ||
    !!sol?.isSolflare ||
    !!sol?.providers?.some?.((p: any) => p?.isSolflare);
  return hasPhantom || hasSolflare;
}

const KEY = "preferredWallet";
function safeGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} }

export function getPreferredWallet(): WalletChoice {
  if (!isBrowser) return "phantom";
  const v = safeGet(KEY);
  return v === "solflare" ? "solflare" : "phantom";
}
export function setPreferredWallet(w: WalletChoice) {
  if (!isBrowser) return;
  safeSet(KEY, w);
}

// ---------- σωστά deeplinks με PATH + ref ----------
function buildLinks(targetUrl: string) {
  const ref = isBrowser ? window.location.origin : "https://happypenis.io";
  const encodedUrl = encodeURIComponent(targetUrl);
  const refUrl = encodeURIComponent(ref);
  return {
    phantomUL: `https://phantom.app/ul/browse/${encodedUrl}?ref=${refUrl}`,
    phantomScheme: `phantom://ul/browse/${encodedUrl}?ref=${refUrl}`,
    solflareUL: `https://solflare.com/ul/v1/browse/${encodedUrl}?ref=${refUrl}`,
    solflareScheme: `solflare://ul/v1/browse/${encodedUrl}?ref=${refUrl}`,
  };
}

// Accepts 1 or 2 args (backward compatible). ΠΡΕΠΕΙ να καλείται πάνω σε tap.
export function openInWalletBrowser(url: string, wallet?: WalletChoice) {
  if (!isBrowser) return;
  const choice = wallet ?? getPreferredWallet();
  const { phantomUL, phantomScheme, solflareUL, solflareScheme } = buildLinks(url);

  const go = (primary: string, scheme: string) => {
    window.location.href = primary;
    setTimeout(() => {
      if (!window.location.href.startsWith(url)) {
        window.location.href = scheme;
      }
    }, 400);
  };

  if (choice === "phantom") {
    go(phantomUL, phantomScheme);
  } else {
    go(solflareUL, solflareScheme);
  }
}

export function walletStoreUrl(wallet: WalletChoice) {
  if (!isBrowser) return "https://phantom.app/";
  const isiOS = /iPhone|iPad|iPod/i.test(UA);
  const isAndroid = /Android/i.test(UA);
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
