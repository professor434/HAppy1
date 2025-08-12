/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

// --- Fallback Extrnode (δικά σου) ---
const FALLBACK_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
const FALLBACK_WS =
  "wss://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

function resolveRpc() {
  const env = ((import.meta as any)?.env ?? {}) as Record<string, string | undefined>;
  // 1) Αν υπάρχει runtime override, το παίρνουμε πρώτο
  let http =
    (typeof window !== "undefined" && (window as any).__RPC_OVRD) ||
    env.VITE_SOLANA_RPC_URL ||
    env.VITE_SOLANA_RPC_HTTP ||
    "";

  let ws =
    env.VITE_SOLANA_WS_URL ||
    env.VITE_SOLANA_RPC_WS ||
    "";

  // HTTP normalize -> ΠΟΤΕ δεν ρίχνουμε throw
  if (!http || !/^https:\/\//i.test(http)) http = FALLBACK_HTTP;

  // WS από HTTP αν λείπει
  if (!ws) {
    try {
      const u = new URL(http);
      u.protocol = "wss:";
      ws = u.toString().replace(/\/$/, "");
    } catch {
      ws = FALLBACK_WS;
    }
  } else {
    try {
      const u = new URL(ws.startsWith("http") ? ws : `https://${ws.replace(/^\/+/, "")}`);
      u.protocol = "wss:";
      ws = u.toString().replace(/\/$/, "");
    } catch {
      ws = FALLBACK_WS;
    }
  }

  if (typeof window !== "undefined") {
    // @ts-ignore
    (window as any).__RPC__ = { http, ws };
  }

  return { http, ws };
}

export default function SolanaProviders({ children }: PropsWithChildren) {
  const { http, ws } = useMemo(resolveRpc, []);

  return (
    <ConnectionProvider
      endpoint={http}
      config={{
        commitment: "confirmed",
        wsEndpoint: ws,
        confirmTransactionInitialTimeout: 9000,
      }}
    >
      {/* Wallet Standard – δεν εισάγουμε explicit adapters για να μην σπάει το build */}
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
