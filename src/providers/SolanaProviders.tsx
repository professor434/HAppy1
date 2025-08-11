import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const ENV = (import.meta as any)?.env ?? {};

const FALLBACK_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

const endpoint: string =
  ENV.VITE_SOLANA_RPC_URL || ENV.VITE_RPC_URL || ENV.SOLANA_RPC || FALLBACK_HTTP;

export default function SolanaProviders({ children }: PropsWithChildren) {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
