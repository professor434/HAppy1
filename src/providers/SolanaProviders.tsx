
import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";
import { SolanaMobileWalletAdapter } from "@solana-mobile/wallet-adapter-mobile";



export default function SolanaProviders({ children }: PropsWithChildren) {

  const endpoint = clusterApiUrl("mainnet-beta");
  const wallets = useMemo(() => [
    new SolanaMobileWalletAdapter({
      appIdentity: {
        name: "Happy Penis Presale",
        uri: typeof window !== "undefined" ? window.location.origin : "https://example.com",
      },
      cluster: "mainnet-beta",
    }),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>

      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
