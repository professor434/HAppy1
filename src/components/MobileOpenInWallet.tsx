import React, { useMemo } from "react";

const isMobile = (ua: string) => /Android|iPhone|iPad|iPod/i.test(ua || "");
const isInApp  = (ua: string) => /Phantom|Solflare/i.test(ua || "");

function buildLinks(target: string) {
  const enc = encodeURIComponent(target);
  return {
    // Τα https /ul/browse είναι πιο σταθερά, τα scheme ως δεύτερη προσπάθεια
    phantomHttp:  `https://phantom.app/ul/browse/${enc}`,
    phantomScheme:`phantom://browse/${enc}`,
    solflareHttp: `https://solflare.com/ul/v1/browse/${enc}`,
    solflareScheme:`solflare://browse/${enc}`,
  };
}

export default function MobileOpenInWallet() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const show = isMobile(ua) && !isInApp(ua);
  const target = useMemo(() => (typeof window !== "undefined" ? window.location.href : ""), []);
  const links  = useMemo(() => buildLinks(target), [target]);
  if (!show) return null;

  const open = (primary: string, fallback: string) => {
    // 1) άνοιξε πρώτα το https ul/browse (πιο σίγουρο)
    window.location.href = primary;
    // 2) μετά από μικρό delay δοκίμασε και scheme
    setTimeout(() => { window.location.href = fallback; }, 400);
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50">
      <div className="rounded-2xl border border-white/10 bg-black/70 backdrop-blur p-3 shadow-lg">
        <div className="text-sm text-white/90 mb-2">
          On mobile, open the presale inside your wallet for a reliable connection.
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => open(links.phantomHttp, links.phantomScheme)}
            className="flex-1 rounded-xl px-4 py-2 bg-violet-600 text-white font-medium"
          >
            Open in Phantom
          </button>
          <button
            onClick={() => open(links.solflareHttp, links.solflareScheme)}
            className="flex-1 rounded-xl px-4 py-2 bg-amber-500 text-black font-medium"
          >
            Open in Solflare
          </button>
        </div>
      </div>
    </div>
  );
}

