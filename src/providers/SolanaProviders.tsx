// src/providers/SolanaProviders.tsx
import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const EXTR = "solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
const HTTP = `https://${EXTR}`;
const WS   = `wss://${EXTR}`;

export default function SolanaProviders({ children }: PropsWithChildren) {
  return (
    <ConnectionProvider endpoint={HTTP} config={{ commitment: "confirmed", wsEndpoint: WS }}>
      {/* Wallet Standard only (χωρίς explicit adapters) */}
      <WalletProvider autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
