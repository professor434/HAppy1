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
    new SolflareWalletAdapter({ network: 'mainnet-beta' }) // Specify network for better connection
  ], []);
  
  return (
    <ConnectionProvider
      endpoint={VITE_SOLANA_RPC_URL}
      config={{ 
        commitment: COMMITMENT, 
        wsEndpoint: VITE_SOLANA_WS_URL || undefined,
        confirmTransactionInitialTimeout: 90000 // Longer timeout for mobile
      }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true} // Enable auto-connect to keep users connected
        onError={(error) => {
          console.warn('Wallet connection error (non-critical):', error);
          // Don't throw errors that would break the app
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
