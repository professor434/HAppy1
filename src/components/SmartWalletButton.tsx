// src/components/SmartWalletButton.tsx
import React, { useEffect, useMemo, useState } from "react";
import CustomWalletButton from "@/components/CustomWalletButton";
import {
  hasInjectedWallet,
  isMobileUA,
  isInWalletWebView,
  openInWalletBrowser,
  walletStoreUrl,
  getPreferredWallet,
  setPreferredWallet,
  type WalletChoice,
} from "@/lib/mobile";

export default function SmartWalletButton() {
  const [ready, setReady] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);
  const [choice, setChoice] = useState<WalletChoice>(() => getPreferredWallet());

  useEffect(() => {
    const check = () => setHasProvider(hasInjectedWallet());
    check();
    const onVis = () => check();
    const onFocus = () => check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    const t = setTimeout(check, 800);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => setReady(true), []);
  useEffect(() => setPreferredWallet(choice), [choice]);

  if (!ready) return null;

  const mobile = isMobileUA();
  const inWallet = isInWalletWebView();

  if (!mobile || inWallet || hasProvider) {
    return <CustomWalletButton />;
  }

  const onOpen = () => openInWalletBrowser(location.href, choice);
  const onInstall = () => window.open(walletStoreUrl(choice), "_blank");

  const Tab = useMemo(
    () =>
      function Tab({ value, label }: { value: WalletChoice; label: string }) {
        const active = choice === value;
        return (
          <button
            onClick={() => setChoice(value)}
            className={[
              "h-9 px-3 rounded-xl font-semibold transition",
              active ? "bg-pink-500 text-white" : "bg-white/10 text-white/80 hover:bg-white/20",
            ].join(" ")}
          >
            {label}
          </button>
        );
      },
    [choice]
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Tab value="phantom" label="Phantom" />
        <Tab value="solflare" label="Solflare" />
      </div>

      <div className="flex items-center gap-8">
        <button
          onClick={onOpen}
          className="h-10 px-4 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.99]"
        >
          Open in {choice === "phantom" ? "Phantom" : "Solflare"} Browser
        </button>
        <button
          onClick={onInstall}
          className="h-10 px-3 rounded-xl font-semibold border border-white/25 text-white hover:bg-white/10"
        >
          Install {choice === "phantom" ? "Phantom" : "Solflare"}
        </button>
      </div>

      <p className="text-xs text-white/70">On iOS, connections work only inside the wallet’s in-app browser.</p>
    </div>
  );
}
