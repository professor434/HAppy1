// src/components/MobileOpenInWallet.tsx
import React from "react";

const isMobile = () =>
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const hasInjected = () => {
  if (typeof window === "undefined") return false;
  // Phantom mobile in-app
  if ((window as unknown as { solana?: { isPhantom?: boolean } }).solana?.isPhantom) return true;
  // Solflare mobile in-app (διάφορες εκδόσεις)
  if ((window as unknown as { solflare?: unknown }).solflare) return true;
  // Backpack/xNFT κ.ά.
  if ((window as unknown as { xnft?: unknown }).xnft) return true;
  return false;
};

export default function MobileOpenInWallet() {
  if (!isMobile() || hasInjected()) return null;

  const url = typeof window !== "undefined" ? window.location.href : "";
  const solflare = `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`;
  const phantom  = `https://phantom.app/ul/browse/${encodeURIComponent(url)}`;

  return (
    <div style={{
      maxWidth: 720, margin: "12px auto", padding: 12,
      border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 14
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Σύνδεση από κινητό</div>
      <p style={{ marginBottom: 12 }}>
        Για απροβλημάτιστη σύνδεση σε κινητό, άνοιξε αυτή τη σελίδα μέσα από το
        πορτοφόλι σου.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <a href={solflare} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          Άνοιγμα σε Solflare
        </a>
        <a href={phantom} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          Άνοιγμα σε Phantom
        </a>
      </div>
    </div>
  );
}
