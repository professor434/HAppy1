// src/providers/SolanaProviders.tsx
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// ---- Defaults (Extrnode σου)
const DEFAULT_HTTP = 'https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2';
const DEFAULT_WS   = 'wss://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2';

const ENV = (import.meta as any)?.env ?? {};
const clean = (s?: string) => (s ?? '').toString().trim();

function normalizeHttp(url?: string) {
  const s = clean(url);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^wss?:\/\//i.test(s)) return s.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
  return '';
}
function normalizeWs(http: string, ws?: string) {
  const s = clean(ws);
  if (/^wss?:\/\//i.test(s)) return s;
  if (/^https?:\/\//i.test(http)) return http.replace(/^https?/i, 'wss');
  return '';
}

const CANDIDATE_HTTP =
  ENV.VITE_SOLANA_RPC_URL ||
  ENV.SOLANA_RPC ||
  ENV.VITE_SOLANA_RPC_HTTP;

const HTTP = normalizeHttp(CANDIDATE_HTTP) || DEFAULT_HTTP;
const WS   = normalizeWs(HTTP, ENV.VITE_SOLANA_WS_URL) || DEFAULT_WS;

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
