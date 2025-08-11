import { useWallet } from "@solana/wallet-adapter-react";

export function CustomWalletButton() {
  const { connected, connecting, connect, disconnect, publicKey } = useWallet();

  const short = publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey
    .toBase58()
    .slice(-4)}` : "";

  if (!connected) {
    return (
      <button
        onClick={() => connect().catch(() => {})}
        disabled={connecting}
        className="rounded-xl px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold shadow z-[9999]"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 z-[9999]">
      <span className="text-white/90 text-sm hidden sm:inline"> {short} </span>
      <button
        onClick={() => disconnect().catch(() => {})}
        className="rounded-xl px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white"
      >
        Disconnect
      </button>
    </div>
  );
}
