// src/components/MobileOpenInWallet.tsx
import React, { useMemo } from "react";

const isMobile = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const isInApp = () => {
  const w = typeof window !== "undefined" ? (window as any) : {};
  return !!(w?.solana?.isPhantom || w?.solflare || w?.xnft);
};

function makeLinks(target: string) {
  const enc = encodeURIComponent(target);
  return {
    phantomPrimary: `phantom://browse/${enc}`,
    phantomFallback: `https://phantom.app/ul/browse/${enc}`,
    solflarePrimary: `solflare://browse/${enc}`,
    solflareFallback: `https://solflare.com/ul/browse/${enc}`,
  };
}

export default function MobileOpenInWallet() {
  const target = useMemo(() => (typeof window !== "undefined" ? window.location.href : ""), []);
  const links = useMemo(() => makeLinks(target), [target]);

  if (!isMobile() || isInApp()) return null;

  const openPhantom = () => {
    const t = setTimeout(() => (window.location.href = links.phantomFallback), 600);
    window.location.href = links.phantomPrimary;
    setTimeout(() => clearTimeout(t), 2000);
  };
  const openSolflare = () => {
    const t = setTimeout(() => (window.location.href = links.solflareFallback), 600);
    window.location.href = links.solflarePrimary;
    setTimeout(() => clearTimeout(t), 2000);
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50">
      <div className="rounded-2xl border border-white/10 bg-black/70 backdrop-blur p-3 shadow-lg">
        <div className="text-sm text-white/90 mb-2">
          On mobile, open this presale inside your wallet for a reliable connection.
        </div>
        <div className="flex gap-2">
          <button
            onClick={openPhantom}
            className="flex-1 rounded-xl px-4 py-2 bg-violet-600 text-white font-medium"
          >
            Open in Phantom
          </button>
          <button
            onClick={openSolflare}
            className="flex-1 rounded-xl px-4 py-2 bg-amber-500 text-black font-medium"
          >
            Open in Solflare
          </button>
        </div>
      </div>
    </div>
  );
}
