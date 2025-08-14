// src/providers/SolanaProviders.tsx
import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { VITE_SOLANA_RPC_URL, VITE_SOLANA_WS_URL, COMMITMENT } from "@/lib/env";

export default function SolanaProviders({ children }: PropsWithChildren) {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter({ network: 'mainnet-beta' })
  ], []);
  
  return (
    <ConnectionProvider
      endpoint={VITE_SOLANA_RPC_URL}
      config={{ 
        commitment: COMMITMENT, 
        wsEndpoint: VITE_SOLANA_WS_URL || undefined,
        confirmTransactionInitialTimeout: 90000
      }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        onError={(error) => {
          console.warn('Wallet connection error (non-critical):', error);
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
