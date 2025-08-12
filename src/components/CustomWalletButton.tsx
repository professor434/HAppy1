// src/components/CustomWalletButton.tsx
import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

// Απλό, σταθερό, με μεγάλο z-index για να μη «κρύβεται».
export default function CustomWalletButton() {
  return <WalletMultiButton className="z-[10000]" />;
}
