import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_RPC_HTTP = "https://api.mainnet-beta.solana.com";
const RAW_HTTP = (import.meta as { env?: { VITE_SOLANA_RPC_URL?: string } })?.env?.VITE_SOLANA_RPC_URL;
const RAW_WS   = (import.meta as { env?: { VITE_SOLANA_WS_URL?: string } })?.env?.VITE_SOLANA_WS_URL;

const HTTP = RAW_HTTP && /^https:\/\//i.test(RAW_HTTP.trim()) ? RAW_HTTP.trim() : DEFAULT_RPC_HTTP;
const WS   = RAW_WS && /^wss?:\/\//i.test(RAW_WS.trim()) ? RAW_WS.trim() : HTTP.replace(/^http/i, "ws");

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
