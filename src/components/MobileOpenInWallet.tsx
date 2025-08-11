import { useMemo } from "react";

const TARGET = "https://happypennisofficialpresale.vercel.app"; // σταθερός στόχος

function isInAppUA(ua: string) {
  ua = ua || "";
  return /Phantom|Solflare/i.test(ua);
}
function isMobile(ua: string) {
  return /Android|iPhone|iPad|iPod/i.test(ua);
}
function buildBrowseLinks(target: string) {
  const enc = encodeURIComponent(target);
  return {
    // Phantom
    phantomA: `phantom://browse/${enc}`,
    phantomB: `https://phantom.app/ul/browse/${enc}`,
    // Solflare
    solflareA: `solflare://browse/${enc}`,
    solflareB: `https://solflare.com/ul/browse/${enc}`,
  };
}

export default function MobileOpenInWallet() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const show = isMobile(ua) && !isInAppUA(ua);

  const links = useMemo(() => buildBrowseLinks(TARGET), []);

  if (!show) return null;

  function openWith(primary: string, fallback: string) {
    // διπλή προσπάθεια (μερικές φορές το 1ο pattern ανοίγει το "home" του wallet)
    const t1 = setTimeout(() => (window.location.href = fallback), 700);
    window.location.href = primary;
    setTimeout(() => clearTimeout(t1), 2000);
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50">
      <div className="rounded-2xl border border-white/10 bg-black/70 backdrop-blur p-3 shadow-lg">
        <div className="text-sm text-white/90 mb-2">
          On mobile, open this presale inside your wallet for a reliable connection.
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openWith(links.phantomA, links.phantomB)}
            className="flex-1 rounded-xl px-4 py-2 bg-violet-600 text-white font-medium"
          >
            Open in Phantom
          </button>
          <button
            onClick={() => openWith(links.solflareA, links.solflareB)}
            className="flex-1 rounded-xl px-4 py-2 bg-amber-500 text-black font-medium"
          >
            Open in Solflare
          </button>
        </div>
      </div>
    </div>
  );
}
