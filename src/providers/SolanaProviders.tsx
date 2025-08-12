// src/providers/SolanaProviders.tsx
import React, { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { makeConnection } from "@/lib/solana";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function SolanaProviders({ children }: PropsWithChildren) {
  // connection endpoint μόνο από το env/solana.ts
  const conn = makeConnection();

  // Δεν εισάγουμε συγκεκριμένα adapters -> παίζουν τα Standard wallets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallets: any[] = [];

  return (
    <ConnectionProvider endpoint={conn.rpcEndpoint} config={{ commitment: "confirmed", wsEndpoint: (conn as unknown as { _rpcWebSocketUrl: string })._rpcWebSocketUrl }}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
