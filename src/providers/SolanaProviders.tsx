// src/providers/SolanaProviders.tsx
import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

// -------- RPC endpoints από env με ασφαλές fallback --------
const HTTP_ENV = (import.meta as any)?.env?.VITE_SOLANA_RPC_URL || "";
const WS_ENV = (import.meta as any)?.env?.VITE_SOLANA_WS_URL || "";

// Extrnode fallback (https / wss)
const FALLBACK_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
const FALLBACK_WS =
  "wss://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

// Validate
const HTTP = /^https:\/\//.test(HTTP_ENV) ? HTTP_ENV : FALLBACK_HTTP;
const WS = /^wss:\/\//.test(WS_ENV) ? WS_ENV : FALLBACK_WS;

export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider
      endpoint={HTTP}
      config={{
        commitment: "confirmed",
        wsEndpoint: WS,
        confirmTransactionInitialTimeout: 70_000, // πιο άνετο για mobile
      }}
    >
      <WalletProvider wallets={wallets} autoConnect onError={(e) => console.error(e)}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
