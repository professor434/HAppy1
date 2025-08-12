// src/App.tsx
// ΠΡΕΠΕΙ να φορτώνει πρώτο για να υπάρχει Buffer στον browser
import "@/buffer-polyfill";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import "@solana/wallet-adapter-react-ui/styles.css";
import React, { useEffect, useMemo, useState } from "react";

const queryClient = new QueryClient();

/** Μικρό banner για κινητά:
 *  Αν ο χρήστης άνοιξε την σελίδα σε “κανονικό” browser και ΔΕΝ υπάρχει injected provider,
 *  του προτείνουμε να ανοίξει μέσα στο in-app browser του wallet.
 */
function MobileOpenInWallet() {
  const [show, setShow] = useState(false);

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod|Android/i.test(ua);
  }, []);

  const deepLinks = useMemo(() => {
    const url = encodeURIComponent(window.location.href);
    return {
      phantom: `https://phantom.app/ul/browse?url=${url}`,
      solflare: `https://solflare.com/ul/browse/${url}`,
      // generic (opens default handler if any)
      generic: `solana://open-url?url=${url}`,
    };
  }, []);

  useEffect(() => {
    // Αν υπάρχει provider, δεν χρειάζεται banner
    const w = window as any;
    const hasProvider =
      !!w.solana || !!w.phantom || !!w.solflare || !!w.backpack;
    setShow(isMobile && !hasProvider);
  }, [isMobile]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        padding: "10px 12px",
        background:
          "linear-gradient(90deg, rgba(80,0,120,.9), rgba(255,0,180,.85))",
        color: "white",
        display: "flex",
        gap: 8,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 14 }}>
        Open this page inside your wallet for smoother transactions.
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <a
          href={deepLinks.phantom}
          style={{
            background: "rgba(255,255,255,.15)",
            padding: "6px 10px",
            borderRadius: 10,
            color: "white",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          Open in Phantom
        </a>
        <a
          href={deepLinks.solflare}
          style={{
            background: "rgba(255,255,255,.15)",
            padding: "6px 10px",
            borderRadius: 10,
            color: "white",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          Open in Solflare
        </a>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WalletModalProvider>
        <Toaster />
        <BrowserRouter>
          <MobileOpenInWallet />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </WalletModalProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
