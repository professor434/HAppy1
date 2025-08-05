import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  MobileWalletAdapter,
  BrowserLocalStorageStore,
} from '@solana-mobile/wallet-adapter-mobile';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { SOLANA_RPC_URL } from '@/lib/solana';

// Import Solana wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<SolanaWalletProviderProps> = ({ children }) => {
  // Choose the network based on environment
  const network = WalletAdapterNetwork.Mainnet; 

  // Configure supported wallets
  const wallets = useMemo(
    () => [
      new MobileWalletAdapter({
        appIdentity: {
          name: 'Happy Penis Presale',
          uri: 'https://happypennisofficialpresale.vercel.app',
          icon: 'https://happypennisofficialpresale.vercel.app/logo192.png',
        },
        authorizationResultCache: new BrowserLocalStorageStore(),
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};