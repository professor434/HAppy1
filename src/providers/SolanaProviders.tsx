// src/providers/SolanaProviders.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { WalletProvider, ConnectionContext } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import type { Connection } from "@solana/web3.js";
import { getConnection } from "@/lib/rpc";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function SolanaProviders({ children }: PropsWithChildren) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  const [connection, setConnection] = useState<Connection | null>(null);

  useEffect(() => {
    getConnection().then(setConnection).catch(() => {});
  }, []);

  if (!connection) return null;

  return (
    <ConnectionContext.Provider value={{ connection }}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionContext.Provider>
  );
}
