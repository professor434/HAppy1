// src/providers/SolanaProviders.tsx
import React, { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const endpoint: string =
  (typeof window !== "undefined" && (window as any).__RPC_OVRD) ||
  (import.meta?.env?.VITE_PUBLIC_RPC as string) ||
  DEFAULT_RPC;

export default function SolanaProviders({ children }: PropsWithChildren) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

