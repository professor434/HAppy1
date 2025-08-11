import React, { useEffect, useMemo } from "react";

const CANONICAL = "https://happypennisofficialpresale.vercel.app/"; // η σελίδα σου

function isInAppUA(ua: string) {
  ua = ua || "";
  return /Phantom|Solflare|Backpack|xNFT/i.test(ua);
}
function isMobile(ua: string) {
  return /Android|iPhone|iPad|iPod/i.test(ua);
}
function buildTarget(base: string, opts?: { w?: "phantom" | "solflare" }) {
  const u = new URL(base);
  u.searchParams.set("dl", "1");
  u.searchParams.set("autoconnect", "1"); // ΣΗΜΑ για auto-connect
  if (opts?.w) u.searchParams.set("w", opts.w);
  return u.toString();
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
  const onMobileOutside = isMobile(ua) && !isInAppUA(ua);

  // default στόχος (χωρίς προτίμηση wallet)
  const target = useMemo(() => buildTarget(CANONICAL), []);
  const links = useMemo(() => buildBrowseLinks(target), [target]);

  // ---------- AUTO DEEPLINK (μία φορά) ----------
  useEffect(() => {
    if (!onMobileOutside) return;
    const onceKey = "hp:autoWalletRedirect";
    const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const force = !!qs?.get("openInWallet");
    if (!force && localStorage.getItem(onceKey) === "1") return;
    localStorage.setItem(onceKey, "1");

    const preferPhantom = /Phantom/i.test(ua);
    const open = () => {
      const primary = preferPhantom ? links.phantomPrimary : links.solflarePrimary;
      const fallback = preferPhantom ? links.phantomFallback : links.solflareFallback;
      const t = setTimeout(() => (window.location.href = fallback), 700);
      window.location.href = primary;
      setTimeout(() => clearTimeout(t), 2000);
    };

    const id = setTimeout(open, 400);
    return () => clearTimeout(id);
  }, [onMobileOutside, ua, links]);

  if (!onMobileOutside) return null;

  function openPhantom() {
    const withPref = buildBrowseLinks(buildTarget(CANONICAL, { w: "phantom" }));
    const t = setTimeout(() => (window.location.href = withPref.phantomFallback), 700);
    window.location.href = withPref.phantomPrimary;
    setTimeout(() => clearTimeout(t), 2000);
  }
  function openSolflare() {
    const withPref = buildBrowseLinks(buildTarget(CANONICAL, { w: "solflare" }));
    const t = setTimeout(() => (window.location.href = withPref.solflareFallback), 700);
    window.location.href = withPref.solflarePrimary;
    setTimeout(() => clearTimeout(t), 2000);
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[10000]">
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
