/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, PropsWithChildren } from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletProvider } from "@solana/wallet-adapter-react";

// --- Fallback Extrnode (δικά σου κλειδιά) ---
const FALLBACK_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
const FALLBACK_WS =
  "wss://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

// Κανονικοποίηση & ασφαλή defaults
function resolveRpc() {
  const env = ((import.meta as any)?.env ?? {}) as Record<string, string | undefined>;

  let http =
    (env.VITE_SOLANA_RPC_URL || env.VITE_SOLANA_RPC_HTTP || "").trim();
  let ws =
    (env.VITE_SOLANA_WS_URL || env.VITE_SOLANA_RPC_WS || "").trim();

  // HTTP
  if (!http || !/^https:\/\//i.test(http)) {
    http = FALLBACK_HTTP;
  }

  // Αν δεν έχεις ρητό WS, το παράγουμε από το HTTP
  if (!ws) {
    try {
      const u = new URL(http);
      u.protocol = "wss:";
      ws = u.toString().replace(/\/$/, "");
    } catch {
      ws = FALLBACK_WS;
    }
  }

  // Εγγυόμαστε wss://
  try {
    const u = new URL(ws.startsWith("http") ? ws : `https://${ws.replace(/^\/+/, "")}`);
    u.protocol = "wss:";
    ws = u.toString().replace(/\/$/, "");
  } catch {
    ws = FALLBACK_WS;
  }

  // (προαιρετικό) δείξε τα endpoints μόνο σε dev
  if (typeof window !== "undefined" && !("production" in process.env)) {
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
      {/* Δεν εισάγουμε explicit adapters (Backpack/OKX κ.λπ.) για να μην σπάει το build.
         Το Wallet Standard εμφανίζει Phantom, Solflare, Backpack, OKX, κ.ά. όπου υπάρχουν. */}
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
