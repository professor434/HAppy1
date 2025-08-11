import React, { useEffect, useMemo, useRef } from "react";

const CANONICAL =
  (import.meta as any)?.env?.VITE_CANONICAL_URL ||
  "https://happypennisofficialpresale.vercel.app";

function isInAppUA(ua: string) {
  ua = ua || "";
  return /Phantom/i.test(ua) || /Solflare/i.test(ua);
}
function isMobile(ua: string) {
  return /Android|iPhone|iPad|iPod/i.test(ua);
}
function buildBrowseLinks(target: string) {
  const enc = encodeURIComponent(target);
  // v1 universal links είναι τα πιο αξιόπιστα σε iOS/Android
  return {
    phantom: `https://phantom.app/ul/v1/browse/${enc}`,
    solflare: `https://solflare.com/ul/v1/browse/${enc}`,
  };
}

export default function MobileOpenInWallet() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const show = isMobile(ua) && !isInAppUA(ua);
  const alreadyTriedRef = useRef(false);

  // Πάντα στέλνουμε τον χρήστη στο canonical URL
  const target = useMemo(() => CANONICAL, []);
  const links = useMemo(() => buildBrowseLinks(target), [target]);

  // Ένα αυτόματο attempt (χωρίς loop)
  useEffect(() => {
    if (!show || alreadyTriedRef.current) return;
    alreadyTriedRef.current = true;
    // Προτιμάμε Phantom πρώτα, μετά Solflare (fallback)
    const t1 = setTimeout(() => {
      window.location.href = links.phantom;
    }, 300);
    const t2 = setTimeout(() => {
      // αν δεν άνοιξε Phantom, δοκίμασε Solflare
      window.location.href = links.solflare;
    }, 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [show, links]);

  if (!show) return null;

  const openPhantom = () => (window.location.href = links.phantom);
  const openSolflare = () => (window.location.href = links.solflare);

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
