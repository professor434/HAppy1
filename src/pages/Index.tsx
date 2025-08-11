/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CustomWalletButton } from "@/components/CustomWalletButton";
import MobileOpenInWallet from "@/components/MobileOpenInWallet";
import CountdownTimer from "@/components/CountdownTimer";
import PurchaseForm from "@/components/PurchaseForm";
import TierInfoList from "@/components/TierInfoList";
import ClaimSection from "@/components/ClaimSection";
import { formatPublicKey, SPL_MINT_ADDRESS } from "@/lib/solana";
import { usePresale } from "@/hooks/use-presale";
import { Spinner } from "@/components/ui/spinner";

export default function PresalePage() {
  const {
    tiers,
    currentTier,
    totalRaised,
    amount,
    setAmount,
    paymentToken,
    setPaymentToken,
    isPending,
    presaleEnded,
    claimableTokens,
    isClaimPending,
    isCheckingStatus,
    buyTokens,
    claimTokens,
    connected,
    goalTokens,
    raisedPercentage,
    isMobile,
    error,
  } = usePresale();

  if (!currentTier) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        {isCheckingStatus ? (
          <Spinner className="text-pink-500" size="lg" />
        ) : error ? (
          <p>Failed to load presale data: {error}</p>
        ) : (
          <p>Presale data unavailable.</p>
        )}
      </div>
    );
  }

  return (
    <>
      <MobileOpenInWallet />
      <div
        className="flex flex-col min-h-screen text-white"
        style={{
          backgroundColor: "#131313",
          backgroundImage: `url('/assets/images/banner.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: isMobile ? "scroll" : "fixed",
        }}
      >
        <div className="fixed bottom-4 right-4 flex gap-2">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">SOL</div>
          <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white">EX</div>
          <div className="h-10 w-10 rounded-full bg-blue-400 flex items-center justify-center text-white">TW</div>
          <div className="h-10 w-10 rounded-full bg-sky-500 flex items-center justify-center text-white">TG</div>
        </div>

        <header className="w-full px-4 py-6 flex justify-between items-center bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <img src="/assets/images/logo.png" alt="Happy Penis Token" className="h-16 w-16" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              Happy Penis Presale
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <CustomWalletButton />
          </div>
        </header>

        <main className="flex-grow flex items-center justify-center p-4">
          <Card className="w-full max-w-xl bg-gray-900/80 border-pink-500/30 backdrop-blur">
            <CardHeader>
              <div className="flex justify-center mb-2">
                <img src="/assets/images/logo.png" alt="Happy Penis Logo" className="h-20 w-20" />
              </div>
              <CardTitle className="text-2xl text-center">Happy Penis Token Presale</CardTitle>
              <CardDescription className="text-center text-gray-300">
                Current Price: 1 PENIS = {currentTier.price_usdc} USDC
              </CardDescription>
              {presaleEnded ? (
                <Badge variant="secondary" className="mx-auto mt-2 bg-pink-500 text-white">
                  Presale Ended - Claim Your Tokens
                </Badge>
              ) : (
                <CountdownTimer currentTier={currentTier} />
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="bg-gray-800/70 p-3 rounded-md text-xs">
                <div className="mb-2 font-medium text-pink-300">Project Details:</div>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <span className="text-gray-400">SPL Address: </span>
                    <span className="font-mono">{formatPublicKey(SPL_MINT_ADDRESS)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.min(100, raisedPercentage).toFixed(2)}%</span>
                </div>
                <Progress value={Math.min(100, raisedPercentage)} className="h-2" />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{totalRaised.toLocaleString()} PENIS</span>
                  <span>{goalTokens.toLocaleString()} PENIS</span>
                </div>
              </div>

              <div className="bg-gray-800/70 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Current Tier: {currentTier.tier}</h3>
                    <p className="text-sm text-gray-400">Price: {currentTier.price_usdc} USDC</p>
                  </div>
                  {!presaleEnded && currentTier.tier > 3 && (
                    <CountdownTimer currentTier={currentTier} label="Tier ends in:" className="text-right" />
                  )}
                </div>
              </div>

              <ClaimSection
                connected={connected}
                isCheckingStatus={isCheckingStatus}
                claimableTokens={claimableTokens}
                presaleEnded={presaleEnded}
                claimTokens={claimTokens}
                isClaimPending={isClaimPending}
              />

              {!presaleEnded && (
                <div className="space-y-4">
                  <Tabs defaultValue="buy" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="buy">Buy Tokens</TabsTrigger>
                      <TabsTrigger value="tiers">Tier Info</TabsTrigger>
                    </TabsList>
                    <TabsContent value="buy" className="space-y-4 pt-4">
                      <PurchaseForm
                        amount={amount}
                        setAmount={setAmount}
                        paymentToken={paymentToken}
                        setPaymentToken={setPaymentToken}
                        buyTokens={buyTokens}
                        isPending={isPending}
                        connected={connected}
                      />
                    </TabsContent>

                    <TabsContent value="tiers" className="pt-4">
                      <TierInfoList tiers={tiers} currentTier={currentTier} />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <footer className="py-4 text-center text-sm text-white bg-black/70">
          <img src="/assets/images/bag1.jpg" alt="Bag" className="mx-auto mb-2 h-12" />
          © 2025 Happy Penis Token. All rights reserved.
        </footer>

        <style jsx global>{`
          .wallet-adapter-dropdown-list {
            z-index: 9999 !important;
          }
        `}</style>
      </div>
    </>
  );
}
