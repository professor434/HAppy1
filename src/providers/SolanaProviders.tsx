import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_EXTRNODE = "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";
const RPC =
  ((import.meta as any)?.env?.VITE_SOLANA_RPC_URL as string) || DEFAULT_EXTRNODE;

if (!/^https:\/\/solana-mainnet\.rpc\.extrnode\.com\//i.test(RPC)) {
  throw new Error("VITE_SOLANA_RPC_URL must be an Extrnode HTTPS endpoint.");
}

export default function SolanaProviders({ children }: PropsWithChildren) {
  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

