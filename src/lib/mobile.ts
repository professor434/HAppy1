// src/lib/mobile.ts
export function isMobileUA(ua = navigator.userAgent || "") {
  return /iphone|ipad|ipod|android/i.test(ua);
}

export function isPhantomUA(ua = navigator.userAgent || "") {
  return /Phantom\/(ios|android)/i.test(ua);
}

export function isSolflareUA(ua = navigator.userAgent || "") {
  return /Solflare/i.test(ua);
}

/** Είμαστε ήδη μέσα στο in-app browser κάποιου wallet; */
export function isInWalletWebView(ua = navigator.userAgent || "") {
  return isPhantomUA(ua) || isSolflareUA(ua);
}

/** Άνοιξε το τρέχον site κατευθείαν μέσα στο wallet browser (iOS/Android). */
export function openInWalletBrowser(url: string) {
  // Phantom deep link (works both platforms)
  if (isPhantomUA() || /phantom/i.test(navigator.userAgent)) {
    const link = `https://phantom.app/ul/browse/${encodeURIComponent(url)}`;
    window.location.href = link;
    return;
  }
  // Solflare deep link
  if (isSolflareUA()) {
    const link = `solflare://browser?url=${encodeURIComponent(url)}`;
    window.location.href = link;
    return;
  }
  // Fallback: απλά μείνε στο ίδιο tab
  window.location.href = url;
}
