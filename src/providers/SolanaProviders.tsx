/* eslint-disable react-hooks/exhaustive-deps */
import { FC, PropsWithChildren, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  WalletAdapterNetwork,
} from "@solana/wallet-adapter-base";

// ΜΟΝΟ standard adapter — θα εμφανίσει Phantom/Solflare/Backpack/OKX κλπ
import { WalletStandardAdapterProvider } from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

function pick(value?: unknown): string {
  if (!value) return "";
  return String(value).trim();
}

function makeWsFromHttp(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return "wss://" + httpUrl.slice(8);
  if (httpUrl.startsWith("http://")) return "ws://" + httpUrl.slice(7);
  return httpUrl; // already ws(s)
}

export const SolanaProviders: FC<PropsWithChildren> = ({ children }) => {
  // Διαβάζουμε και από fallback κλειδιά για να μην “πεθάνει” σε preview
  const rawHTTP =
    pick((import.meta as any)?.env?.VITE_SOLANA_RPC_URL) ||
    pick((import.meta as any)?.env?.VITE_SOLANA_RPC) ||
    pick((import.meta as any)?.env?.SOLANA_RPC); // έσχατο fallback

  const rawWS =
    pick((import.meta as any)?.env?.VITE_SOLANA_WS_URL) || makeWsFromHttp(rawHTTP);

  // ΑΥΣΤΗΡΟΣ έλεγχος με καθαρό μήνυμα
  if (!/^https:\/\/.+/i.test(rawHTTP)) {
    // βοήθεια στο debug αν ξανασυμβεί
    // @ts-ignore
    if (typeof window !== "undefined") (window as any).__BAD_RPC__ = rawHTTP;
    throw new Error("VITE_SOLANA_RPC_URL must be a valid https:// endpoint");
  }

  const endpoint = useMemo(() => rawHTTP, [rawHTTP]);
  const wsEndpoint = useMemo(() => rawWS, [rawWS]);

  // autoConnect = true + μόνο standard provider (για να μην διπλοεγγράφονται οι ίδιες wallets)
  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{
        commitment: "confirmed",
        wsEndpoint,
        confirmTransactionInitialTimeout: 40_000,
      }}
    >
      <WalletProvider wallets={[new WalletStandardAdapterProvider()]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
