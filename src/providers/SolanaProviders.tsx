import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
// …imports wallets…

const ENV = (import.meta as any)?.env ?? {};
const trim = (s?: string) => (s ?? '').toString().trim();

const RAW_HTTP = trim(ENV.VITE_SOLANA_RPC_URL || ENV.SOLANA_RPC || ENV.VITE_SOLANA_RPC_HTTP);
const HTTP = RAW_HTTP.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
if (!/^https?:\/\//i.test(HTTP)) throw new Error('VITE_SOLANA_RPC_URL must be https(s)://');

const RAW_WS = trim(ENV.VITE_SOLANA_WS_URL);
const WS = RAW_WS
  ? RAW_WS.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:')
  : HTTP.replace(/^http/i, 'ws');

export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint={HTTP} config={{ commitment: 'confirmed', wsEndpoint: WS }}>
      <WalletProvider wallets={/* … */} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
