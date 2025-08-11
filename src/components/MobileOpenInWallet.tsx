import React, { useMemo } from "react";

const DAPP_URL =
  (import.meta as any)?.env?.VITE_DAPP_URL ||
  (typeof window !== "undefined" ? window.location.href : "");

function isMobile(ua: string) { return /Android|iPhone|iPad|iPod/i.test(ua || ""); }
function isInApp(ua: string) { return /Phantom|Solflare/i.test(ua || ""); }

function buildLinks(target: string) {
  const enc = encodeURIComponent(target.endsWith("/") ? target : target + "/");
  return {
    phantomPrimary: `phantom://browse/${enc}#autoconnect=1`,
    phantomFallback: `https://phantom.app/ul/browse/${enc}#autoconnect=1`,
    solflarePrimary: `solflare://browse/${enc}#autoconnect=1`,
    solflareFallback: `https://solflare.com/ul/v1/browse/${enc}#autoconnect=1`,
  };
}

export default function MobileOpenInWallet() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const show = isMobile(ua) && !isInApp(ua);

  const target = useMemo(() => DAPP_URL, []);
  const links = useMemo(() => buildLinks(target), [target]);

  if (!show) return null;

  const jump = (primary: string, fallback: string) => {
    const t = setTimeout(() => (window.location.href = fallback), 700);
    window.location.href = primary;
    setTimeout(() => clearTimeout(t), 2000);
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50">
      <div className="rounded-2xl border border-white/10 bg-black/70 backdrop-blur p-3 shadow-lg">
        <div className="text-sm text-white/90 mb-2">
          On mobile, open this presale <b>inside your wallet</b> for a reliable connection.
        </div>
        <div className="flex gap-2">
          <button onClick={() => jump(links.phantomPrimary, links.phantomFallback)}
                  className="flex-1 rounded-xl px-4 py-2 bg-violet-600 text-white font-medium">
            Open in Phantom
          </button>
          <button onClick={() => jump(links.solflarePrimary, links.solflareFallback)}
                  className="flex-1 rounded-xl px-4 py-2 bg-amber-500 text-black font-medium">
            Open in Solflare
          </button>
        </div>
      </div>
    </div>
  );
}
