import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

export const CustomWalletButton = () => (
  <div style={{ zIndex: 9999 }}>
    <WalletMultiButton />
  </div>
);
