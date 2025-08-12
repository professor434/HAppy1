import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import("@solana/wallet-adapter-react-ui/styles.css"); // keep styles

export default function SolanaProviders({ children }: { children: ReactNode }) {
  const HTTP =
    ((import.meta as any)?.env?.VITE_SOLANA_RPC_URL as string | undefined)?.trim() ||
    "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
  const WS =
    ((import.meta as any)?.env?.VITE_SOLANA_WS_URL as string | undefined)?.trim() ||
    HTTP.replace(/^https?/i, "wss");

  const endpoint = useMemo(() => HTTP, [HTTP]);
  const config = useMemo(
    () => ({ commitment: "confirmed" as const, wsEndpoint: WS }),
    [WS]
  );

  // Δεν περνάμε λίστα wallets – τα Standard wallets (Phantom, Solflare, Backpack)
  // ανιχνεύονται αυτόματα μέσω Wallet Standard.
  return (
    <ConnectionProvider endpoint={endpoint} config={config}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
