// src/components/CustomWalletButton.tsx
import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function CustomWalletButton() {
  return <WalletMultiButton className="z-[10000] relative" />;
}
