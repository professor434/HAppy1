// src/providers/SolanaProviders.tsx
import { PropsWithChildren, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import "@solana/wallet-adapter-react-ui/styles.css";

import { RPC_HTTP, RPC_WS, assertEnv } from "@/lib/env";

export default function SolanaProviders({ children }: PropsWithChildren) {
  // Βεβαιώσου ότι τα env είναι legit (και αυτοδιορθωμένα)
  assertEnv();

  const { endpoint, wsEndpoint } = useMemo(
    () => ({ endpoint: RPC_HTTP, wsEndpoint: RPC_WS }),
    []
  );

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{
        wsEndpoint,
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 90_000,
      }}
    >
      {/* Wallet Standard: αφήνουμε κενό το array για να εμφανίζει Phantom/Solflare/κλπ */}
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
