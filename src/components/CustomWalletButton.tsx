import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function hasInjected() {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.solana?.isPhantom || w.solflare);
}

export function CustomWalletButton() {
  const {
    wallets,
    wallet,
    select,
    connect,
    disconnect,
    connected,
    connecting,
    publicKey,
  } = useWallet();

  const short = useMemo(
    () => (publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : ""),
    [publicKey]
  );

  const pickDefault = () => {
    const by = (name: string) =>
      wallets.find((w) => w.adapter.name.toLowerCase().includes(name));
    return (
      by("phantom")?.adapter.name ||
      by("solflare")?.adapter.name ||
      wallets[0]?.adapter.name
    );
  };

  const doConnect = async () => {
    // Αν είμαστε σε mobile browser ΧΩΡΙΣ injected wallet → δείξε το banner (όχι connect εδώ)
    if (isMobileUA() && !hasInjected()) {
      alert("Open this page inside Phantom or Solflare (use the buttons at the bottom).");
      return;
    }
    const name = pickDefault();
    if (name) await select(name);
    await connect();
  };

  const changeWallet = async () => {
    const current = wallet?.adapter.name;
    const others = wallets.filter((w) => w.adapter.name !== current);
    if (!others.length) return;
    await disconnect().catch(() => {});
    await select(others[0].adapter.name);
    await connect();
  };

  // --- UI ---
  if (!connected) {
    return (
      <button
        onClick={doConnect}
        disabled={connecting}
        className="z-[9999] rounded-xl px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold shadow"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="z-[9999] flex items-center gap-2">
      <span className="text-white/90 text-sm hidden sm:inline">{short}</span>
      <button
        onClick={changeWallet}
        className="rounded-xl px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white"
      >
        Change
      </button>
      <button
        onClick={() => disconnect().catch(() => {})}
        className="rounded-xl px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white"
      >
        Disconnect
      </button>
    </div>
  );
}

export default CustomWalletButton;

