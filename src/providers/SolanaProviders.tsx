// src/providers/SolanaProviders.tsx
import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";

// Σημαντικό: ΔΕΝ περνάμε explicit wallets array με Phantom/Solflare adapters.
// Τα Standard wallets καταχωρούνται αυτόματα στα σύγχρονα περιβάλλοντα.
export default function SolanaProviders({ children }: PropsWithChildren) {
  const endpoint = clusterApiUrl("mainnet-beta");
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
