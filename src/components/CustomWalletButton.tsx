/* src/components/CustomWalletButton.tsx */
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function CustomWalletButton() {
  // Use built-in MultiButton for wallet selection/connect/disconnect
  return (
    <div className="relative z-[10000]">
      <WalletMultiButton className="!bg-gradient-to-r !from-pink-500 !to-purple-500 !text-white !rounded-xl !px-4 !py-2 !h-auto" />
    </div>
  );
}

export default CustomWalletButton;

