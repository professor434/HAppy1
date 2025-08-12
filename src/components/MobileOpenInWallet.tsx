// src/components/MobileOpenInWallet.tsx
// No-op version to avoid banner while keeping imports intact
import React from "react";
export default function MobileOpenInWallet() { return null; }
 if (typeof window === "undefined") return null;
  if (!isMobileUA() || isInWalletWebView()) return null;

  const onOpen = () => openInWalletBrowser(location.href);

  return (
    <div style={{
      position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 9999,
      background: "rgba(20,20,30,.9)", border: "1px solid rgba(255,255,255,.15)",
      borderRadius: 12, padding: "14px 16px", color: "#fff", backdropFilter: "blur(6px)"
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Open inside your wallet</div>
      <div style={{ fontSize: 13, opacity: .9, marginBottom: 10 }}>
        For the smoothest experience on mobile, open this page inside your wallet’s browser.
      </div>
      <button
        onClick={onOpen}
        style={{
          width: "100%", height: 40, borderRadius: 10, border: "none",
          background: "#7c3aed", color: "#fff", fontWeight: 600
        }}
      >
        Open in Wallet Browser
      </button>
    </div>
  );
}
