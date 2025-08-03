import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatPublicKey } from '@/lib/solana';

interface CustomWalletButtonProps {
  className?: string;
}

export function CustomWalletButton({ className }: CustomWalletButtonProps) {
  const { publicKey, connected } = useWallet();

  return (
    <div className="wallet-adapter-dropdown">
      <WalletMultiButton 
        className={cn(
          "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 px-4 py-2 rounded-md text-white font-medium shadow-md hover:shadow-lg transition-all duration-300",
          className
        )}
      >
        {connected && publicKey 
          ? `${formatPublicKey(publicKey)}`
          : "Connect Wallet"
        }
      </WalletMultiButton>
    </div>
  );
}