// src/lib/mobile.ts
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
  const w = window as any;
  return !!(w.solana || w.phantom || w.solflare || w.backpack);
}

export function openInWalletBrowser(url: string) {
  const encoded = encodeURIComponent(url);
  // Προτεραιότητα Phantom (δουλεύει και σε iOS/Android)
  window.location.href = `https://phantom.app/ul/browse?url=${encoded}`;
}

export function phantomStoreUrl() {
  const ua = navigator.userAgent || "";
  const isiOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (isiOS) return "https://apps.apple.com/app/phantom-crypto-wallet/id1598432977";
  if (isAndroid)
    return "https://play.google.com/store/apps/details?id=app.phantom&hl=en";
  return "https://phantom.app/";
}
