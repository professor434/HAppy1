import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC = import.meta.env.VITE_SOLANA_RPC_URL as string;

export default function SolanaProviders({ children }: PropsWithChildren) {
  return (
    <ConnectionProvider endpoint={RPC} config={{ wsEndpoint: import.meta.env.VITE_SOLANA_WS_URL as string }}>
      <WalletProvider autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
