import { PropsWithChildren } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

const RPC = (import.meta as any)?.env?.VITE_SOLANA_RPC_URL as string; // REQUIRED

export default function SolanaProviders({ children }: PropsWithChildren) {
  return (
    <ConnectionProvider endpoint={RPC}>
      {/* Wallet Standard only */}
      <WalletProvider autoConnect>{children}</WalletProvider>
    </ConnectionProvider>
  );
}
