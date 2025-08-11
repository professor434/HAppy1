// src/components/MobileOpenInWallet.tsx
import React, { useMemo } from "react";

function isInAppUA(ua: string) {
  ua = ua || "";
  return /Phantom/i.test(ua) || /Solflare/i.test(ua) || /Backpack/i.test(ua);
}
function isMobile(ua: string) {
  return /Android|iPhone|iPad|iPod/i.test(ua);
}
function buildBrowseLinks(target: string) {
  const enc = encodeURIComponent(target);
  return {
    phantomPrimary: `phantom://browse/${enc}`,
    phantomFallback: `https://phantom.app/ul/browse/${enc}`,
    solflarePrimary: `solflare://browse/${enc}`,
    solflareFallback: `https://solflare.com/ul/browse/${enc}`,
  };
}

export default function MobileOpenInWallet() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const show = isMobile(ua) && !isInAppUA(ua);

  const target = useMemo(() => (typeof window === "undefined" ? "" : window.location.href), []);
  const links = useMemo(() => buildBrowseLinks(target), [target]);

  if (!show) return null;

  function openPhantom() {
    const t = setTimeout(() => (window.location.href = links.phantomFallback), 700);
    window.location.href = links.phantomPrimary;
    setTimeout(() => clearTimeout(t), 2000);
  }
  function openSolflare() {
    const t = setTimeout(() => (window.location.href = links.solflareFallback), 700);
    window.location.href = links.solflarePrimary;
    setTimeout(() => clearTimeout(t), 2000);
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[9999]">
      <div className="rounded-2xl border border-white/10 bg-black/70 backdrop-blur p-3 shadow-lg">
        <div className="text-sm text-white/90 mb-2">
          On mobile, open this presale inside your wallet for a reliable connection.
        </div>
        <div className="flex gap-2">
          <button onClick={openPhantom} className="flex-1 rounded-xl px-4 py-2 bg-violet-600 text-white font-medium">
            Open in Phantom
          </button>
          <button onClick={openSolflare} className="flex-1 rounded-xl px-4 py-2 bg-amber-500 text-black font-medium">
            Open in Solflare
          </button>
        </div>
      </div>
    </div>
  );
}
