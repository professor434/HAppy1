// src/providers/SolanaProviders.tsx

import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react";


// Σημαντικό: ΔΕΝ περνάμε explicit wallets array με Phantom/Solflare adapters.
// Τα Standard wallets καταχωρούνται αυτόματα στα σύγχρονα περιβάλλοντα.
export default function SolanaProviders({ children }: PropsWithChildren) {
s
  const http = (import.meta.env.VITE_SOLANA_RPC_URL as string)
    || "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
  const ws = (import.meta.env.VITE_SOLANA_WS_URL as string)
    || http.replace(/^http/i, "ws");

  const config = useMemo(() => ({
    commitment: "confirmed" as const,
    wsEndpoint: ws,
    confirmTransactionInitialTimeout: 90_000,
  }), [ws]);

  // WalletProvider requires an array; fall back to Standard wallets so
  // `.filter` operations inside the adapter hooks don't throw on undefined.
  const wallets = useStandardWalletAdapters([]);

  return (
    <ConnectionProvider endpoint={http} config={config}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>

    </ConnectionProvider>
  );
}
