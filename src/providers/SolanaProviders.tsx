import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";
import {
  SolanaMobileWalletAdapter,
  createDefaultAuthorizationResultCache,
} from "@solana-mobile/wallet-adapter-mobile";

export default function SolanaProviders({ children }: PropsWithChildren) {
  const endpoint = import.meta.env.VITE_RPC_URL || clusterApiUrl("mainnet-beta");
  const wsEndpoint = import.meta.env.VITE_SOLANA_WS_URL;
  const wallets = useMemo(() => [
    new SolanaMobileWalletAdapter({
      appIdentity: {
        name: "Happy Penis Presale",
        uri: typeof window !== "undefined" ? window.location.origin : "https://example.com",
      },
      cluster: "mainnet-beta",
      authorizationResultCache: createDefaultAuthorizationResultCache(),
    }),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed", wsEndpoint }}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
