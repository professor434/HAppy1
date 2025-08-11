// src/providers/SolanaProviders.tsx
import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

// ΑΠΑΓΟΡΕΥΕΤΑΙ fallback. Θέλουμε ΜΟΝΟ Extrnode HTTP URL από .env
const RPC = (import.meta as any)?.env?.VITE_SOLANA_RPC_URL as string;

// Runtime φρένο για να μη φύγει ποτέ σε λάθος RPC
if (!RPC) {
  throw new Error("Missing VITE_SOLANA_RPC_URL (must be your Extrnode HTTP URL).");
}
if (!/^https:\/\/solana-mainnet\.rpc\.extrnode\.com\//i.test(RPC)) {
  throw new Error("VITE_SOLANA_RPC_URL must be an Extrnode HTTPS endpoint.");
}

export default function SolanaProviders({ children }: PropsWithChildren) {
  return (
    <ConnectionProvider endpoint={RPC}>
      {/* ΠΑΝΤΑ array, αλλιώς .filter crash */}
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
