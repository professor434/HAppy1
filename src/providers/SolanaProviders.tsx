// src/providers/SolanaProviders.tsx
import { FC, PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

const DEFAULT_HTTP =
  "https://solana-mainnet.rpc.extrnode.com/abba3bc7-b46a-4acb-8b15-834781a11ae2";

export const SolanaProviders: FC<PropsWithChildren> = ({ children }) => {
  const HTTP = (import.meta as any)?.env?.VITE_SOLANA_RPC_URL || DEFAULT_HTTP;
  if (!/^https:\/\//i.test(String(HTTP))) {
    throw new Error("VITE_SOLANA_RPC_URL must be a valid https:// endpoint");
  }
  const WS =
    (import.meta as any)?.env?.VITE_SOLANA_WS_URL ||
    String(HTTP).replace(/^https:/i, "wss:");

  const cfg = useMemo(
    () => ({ commitment: "confirmed" as const, wsEndpoint: WS }),
    [WS]
  );

  return (
    <ConnectionProvider endpoint={HTTP} config={cfg}>
      {/* Χωρίς λίστα wallets: βασιζόμαστε στο Wallet Standard (Phantom/Solflare inject) */}
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};
export default SolanaProviders;

