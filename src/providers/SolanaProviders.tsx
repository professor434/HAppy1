// src/providers/SolanaProviders.tsx
import React, { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { RPC_HTTP, RPC_WS, assertEnv } from "@/lib/env";

export default function SolanaProviders({ children }: PropsWithChildren) {
  const [endpoint, setEndpoint] = useState(RPC_HTTP);
  const [ws, setWs] = useState(RPC_WS);

  useEffect(() => {
    assertEnv().then(() => {
      setEndpoint(RPC_HTTP);
      setWs(RPC_WS);
    });
  }, []);

  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "finalized", wsEndpoint: ws }}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

