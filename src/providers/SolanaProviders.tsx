import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  SolanaMobileWalletAdapter,
  createDefaultAuthorizationResultCache,
} from "@solana-mobile/wallet-adapter-mobile";

export default function SolanaProviders({ children }: PropsWithChildren) {
  const endpoint =
    import.meta.env.VITE_RPC_URL ||
    import.meta.env.SOLANA_RPC ||
    "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834787a11ae2";
  const wsEndpoint =
    import.meta.env.VITE_SOLANA_WS_URL ||
    "wss://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834787a11ae2";
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
