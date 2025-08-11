/* eslint-disable react-hooks/exhaustive-deps */
import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

require("@solana/wallet-adapter-react-ui/styles.css");

function clean(v: unknown) {
  return String(v ?? "")
    .replace(/^['"]|['"]$/g, "") // strip quotes if someone pasted with quotes
    .trim();
}

const RAW_HTTP = import.meta.env.VITE_SOLANA_RPC_URL ?? import.meta.env.SOLANA_RPC ?? "";
const RAW_WS   = import.meta.env.VITE_SOLANA_WS_URL ?? "";

const HTTP_ENV = clean(RAW_HTTP);
const WS_ENV   = clean(RAW_WS);

// 🔒 Fallbacks (ίδια project id με Extrnode που μου έδωσες)
const FALLBACK_HTTP = "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

const HTTP = /^https:\/\//i.test(HTTP_ENV) ? HTTP_ENV : FALLBACK_HTTP;
const WS   = /^wss:\/\//i.test(WS_ENV) ? WS_ENV : HTTP.replace(/^https/i, "wss");

export default function SolanaProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={HTTP} config={{ commitment: "confirmed", wsEndpoint: WS }}>
      <WalletProvider wallets={wallets} autoConnect onError={() => { /* swallow */ }}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
