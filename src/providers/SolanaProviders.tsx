// src/providers/SolanaProviders.tsx
import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const HTTP = import.meta.env.VITE_SOLANA_RPC_URL!;
const WS   = import.meta.env.VITE_SOLANA_WS_URL || HTTP.replace(/^http/i, "ws");

export default function SolanaProviders({ children }: PropsWithChildren) {
  if (!HTTP) throw new Error("Missing VITE_SOLANA_RPC_URL");

  return (
    <ConnectionProvider endpoint={HTTP} config={{ wsEndpoint: WS }}>
      {/* wallets=[] για να μην σκάει το .filter όταν δεν δίνουμε adapters */}
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
