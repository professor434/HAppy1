// src/providers/SolanaProviders.tsx
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// --- Read & normalize RPC endpoints ---
const ENV = (import.meta as any)?.env ?? {};
const trim = (s?: string) => (s ?? '').toString().trim();

const RAW_HTTP =
  trim(ENV.VITE_SOLANA_RPC_URL || ENV.SOLANA_RPC || ENV.VITE_SOLANA_RPC_HTTP);

const HTTP = RAW_HTTP.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
if (!/^https?:\/\//i.test(HTTP)) {
  throw new Error('VITE_SOLANA_RPC_URL must be a valid https:// endpoint');
}

const RAW_WS = trim(ENV.VITE_SOLANA_WS_URL);
const WS = (RAW_WS || HTTP.replace(/^http/i, 'ws'))
  .replace(/^https:/i, 'wss:')
  .replace(/^http:/i, 'ws:');

export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={HTTP} config={{ commitment: 'confirmed', wsEndpoint: WS }}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
