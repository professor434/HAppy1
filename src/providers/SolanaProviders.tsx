import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

const RAW_HTTP = (import.meta as { env?: { VITE_SOLANA_RPC_URL?: string } })?.env?.VITE_SOLANA_RPC_URL;
const RAW_WS   = (import.meta as { env?: { VITE_SOLANA_WS_URL?: string } })?.env?.VITE_SOLANA_WS_URL;

function getRpcEndpoint(u?: string) {
  if (u && /^https:\/\//i.test(u)) return u;
  console.warn(`VITE_SOLANA_RPC_URL missing or invalid; using ${DEFAULT_RPC}`);
  return DEFAULT_RPC;
}

const HTTP = getRpcEndpoint(RAW_HTTP);
const WS   = RAW_WS && /^wss?:\/\//i.test(RAW_WS) ? RAW_WS : HTTP.replace(/^https?/i, "ws");

export default function SolanaProviders({ children }: PropsWithChildren) {
  const cfg = useMemo(
    () => ({
      commitment: "confirmed" as const,
      wsEndpoint: WS,
      confirmTransactionInitialTimeout: 45_000,
    }),
    [WS]
  );

  return (
    <ConnectionProvider endpoint={HTTP} config={cfg}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
