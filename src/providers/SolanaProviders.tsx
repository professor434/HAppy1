import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const RAW_HTTP = (import.meta as any)?.env?.VITE_SOLANA_RPC_URL as string | undefined;
const RAW_WS   = (import.meta as any)?.env?.VITE_SOLANA_WS_URL as string | undefined;

function assertHttps(u?: string) {
  if (!u || !/^https:\/\//i.test(u)) {
    throw new Error("VITE_SOLANA_RPC_URL must be a valid https:// endpoint");
  }
  return u;
}
const HTTP = assertHttps(RAW_HTTP);
const WS   = RAW_WS && /^wss?:\/\//i.test(RAW_WS) ? RAW_WS : HTTP.replace(/^http/i, "ws");

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
