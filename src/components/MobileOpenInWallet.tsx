/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";

const isMobile = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const hasInjected = () => {
  if (typeof window === "undefined") return false;
  if ((window as any).solana?.isPhantom) return true;
  if ((window as any).solflare) return true;
  if ((window as any).xnft) return true; // Backpack
  return false;
};

export default function MobileOpenInWallet() {
  if (!isMobile() || hasInjected()) return null;

  const dappUrl = typeof window !== "undefined" ? window.location.href : "https://example.com";
  const phantom  = `https://phantom.app/ul/browse/${encodeURIComponent(dappUrl)}`;
  const solflare = `https://solflare.com/ul/v1/browse/${encodeURIComponent(dappUrl)}`;
  const backpack = `https://www.backpack.app/ul/browse/${encodeURIComponent(dappUrl)}`;

  return (
    <div style={{
      position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 9999,
      background: "rgba(0,0,0,.8)", color: "white", padding: 12, borderRadius: 12, backdropFilter: "blur(6px)",
    }}>
      <b>Συμβουλή για κινητά:</b> Άνοιξε τη σελίδα <i>μέσα από</i> το wallet σου για άψογη ροή.
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <a href={phantom}  style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, color: "white" }}>Άνοιγμα σε Phantom</a>
        <a href={solflare} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, color: "white" }}>Άνοιγμα σε Solflare</a>
        <a href={backpack} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, color: "white" }}>Άνοιγμα σε Backpack</a>
      </div>
    </div>
  );
}
