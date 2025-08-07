import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { toast } from "sonner";
import {
  executeSOLPayment,
  executeUSDCPayment,
  executeClaimFeePayment,
  formatPublicKey,
  SPL_MINT_ADDRESS,
  TREASURY_WALLET,
  FEE_WALLET,
  connection
} from '@/lib/solana';
import { CustomWalletButton } from '@/components/CustomWalletButton';
import { recordPurchase, canClaimTokens, recordClaim, getCurrentTier, getPresaleStatus } from '@/lib/api';
import { Badge } from "@/components/ui/badge";
// import { Spinner } from "@/components/ui/spinner"; // Δεν χρησιμοποιείται

const PRESALE_TIERS = [
  { tier: 1, price_usdc: 0.000260, limit: 237500000, duration_days: null },
  { tier: 2, price_usdc: 0.000312, limit: 237500000, duration_days: null },
  { tier: 3, price_usdc: 0.000374, limit: 237500000, duration_days: null },
  { tier: 4, price_usdc: 0.000449, limit: 237500000, duration_days: 30 },
  { tier: 5, price_usdc: 0.000539, limit: 237500000, duration_days: 30 },
  { tier: 6, price_usdc: 0.000647, limit: 237500000, duration_days: 30 },
  { tier: 7, price_usdc: 0.000776, limit: 237500000, duration_days: 30 },
  { tier: 8, price_usdc: 0.000931, limit: 237500000, duration_days: 30 }
];
const PRESALE_GOAL_USDC = 1100000000;
const SOL_TO_USDC_RATE = 170;
// const PRESALE_END_DATE = new Date('2025-12-31'); // δεν χρησιμοποιείται

export default function PresalePage() {
  const { toast: uiToast } = useToast();
  const { publicKey, connected, signTransaction, connect, wallet } = useWallet();
  const [currentTier, setCurrentTier] = useState(PRESALE_TIERS[0]);
  const [totalRaised, setTotalRaised] = useState(0);
  const [amount, setAmount] = useState("");
  const [paymentToken, setPaymentToken] = useState("SOL");
  const [countdownTime, setCountdownTime] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [presaleEnded, setPresaleEnded] = useState(false);
  const [claimableTokens, setClaimableTokens] = useState(null);
  const [isClaimPending, setIsClaimPending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  // Κράτα forcePresaleEnd μόνο αν το θες για dev. Αν όχι, αφαίρεσέ το.
  // const [forcePresaleEnd, setForcePresaleEnd] = useState(false);

  // Reconnect automatically when returning from a mobile wallet
  useEffect(() => {
    const handleConnect = () => {
      checkClaimStatus();
    };
    wallet?.adapter.on('connect', handleConnect);
    return () => {
      wallet?.adapter.off('connect', handleConnect);
    };
  }, [wallet]);

  useEffect(() => {
    if (connected && publicKey) {
      checkClaimStatus();
    } else {
      setClaimableTokens(null);
    }
  }, [connected, publicKey]);

  useEffect(() => {
    fetchPresaleStatus();
  }, []);

  // Αν θες να κλείνει το presale χειροκίνητα, βάλε λογική εδώ.  
  // Αν όχι, μπορείς να αφαιρέσεις το presaleEnded ή να το ελέγχεις από backend status.
  // useEffect(() => {
  //   setPresaleEnded(forcePresaleEnd);
  // }, [forcePresaleEnd]);

  useEffect(() => {
    if (currentTier.tier <= 3) {
      setCountdownTime("No time limit - Complete sale to advance");
      return;
    }
    const tierStartDate = new Date('2025-08-01');
    const tierEndDate = new Date(tierStartDate);
    const duration = currentTier.duration_days || 30;
    tierEndDate.setDate(tierEndDate.getDate() + duration);
    const updateCountdown = () => {
      const now = new Date();
      const diff = tierEndDate.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdownTime("Tier ended");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownTime(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [currentTier]);

  useEffect(() => {
    let raisedSoFar = 0;
    for (const tier of PRESALE_TIERS) {
      if (raisedSoFar + tier.limit > totalRaised) {
        setCurrentTier(tier);
        break;
      }
      raisedSoFar += tier.limit;
    }
  }, [totalRaised]);

  const fetchPresaleStatus = async () => {
    try {
      setIsCheckingStatus(true);
      const tierInfo = await getCurrentTier();
      if (tierInfo) setCurrentTier(tierInfo);
      const status = await getPresaleStatus();
      if (status) {
        setTotalRaised(status.raised);
        // Δες αν το backend επιστρέφει presaleEnded!
        if (status.presaleEnded !== undefined) setPresaleEnded(status.presaleEnded);
      }
    } catch (error) {
      console.error("Error fetching presale status:", error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const checkClaimStatus = async () => {
    if (publicKey && connected) {
      try {
        setIsCheckingStatus(true);
        const claimInfo = await canClaimTokens(publicKey.toString());
        setClaimableTokens(claimInfo);
      } catch (error) {
        toast.error("Failed to check claim status");
        setClaimableTokens(null);
      } finally {
        setIsCheckingStatus(false);
      }
    }
  };

  // const togglePresaleStatus = () => {
  //   setForcePresaleEnd(!forcePresaleEnd);
  // };

  const buyTokens = async () => {
    toast.info("Starting purchase process...");
    if (!connected) {
      try { await connect(); } catch { return; }
    }
    if (!publicKey) {
      toast.error("Wallet not connected");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Invalid amount");
      return;
    }
    setIsPending(true);
    try {
      const penisAmount = parseFloat(amount);
      const totalPrice = penisAmount * currentTier.price_usdc;
      let txSignature = null;
      if (paymentToken === "SOL" && publicKey && signTransaction) {
        const solPrice = totalPrice / SOL_TO_USDC_RATE;
        txSignature = await executeSOLPayment(solPrice, { publicKey, signTransaction });
      } else if (paymentToken === "USDC" && publicKey && signTransaction) {
        txSignature = await executeUSDCPayment(totalPrice, { publicKey, signTransaction });
      } else {
        toast.error("Invalid payment method or wallet not properly connected");
        throw new Error();
      }
      if (!txSignature) throw new Error();
      window.lastTransactionSignature = txSignature;
      await recordPurchase(publicKey.toString(), penisAmount, paymentToken, txSignature);
      setTotalRaised(prev => prev + penisAmount);
      setAmount("");
      checkClaimStatus();
      toast.success("Purchase completed successfully!");
    } catch (error) {
      toast.error("Transaction failed");
    } finally {
      setIsPending(false);
    }
  };

  const claimTokens = async () => {
    if (!connected) { try { await connect(); } catch { return; } }
    if (!publicKey || !claimableTokens?.canClaim || !claimableTokens.total) return;
    setIsClaimPending(true);
    try {
      const tokenAmount = parseFloat(claimableTokens.total);
      const txSignature = await executeClaimFeePayment(tokenAmount, { publicKey, signTransaction });
      if (!txSignature) throw new Error("Claim fee payment failed");
      const success = await recordClaim(publicKey.toString(), txSignature);
      if (success) {
        uiToast({ title: "Claim Successful!", description: `You claimed ${tokenAmount.toLocaleString()} PENIS tokens` });
        setClaimableTokens({ ...claimableTokens, canClaim: false });
      } else {
        throw new Error("Failed to record claim on server");
      }
    } catch (error) {
      uiToast({ title: "Claim Failed", description: error instanceof Error ? error.message : "Could not complete the claim. Please try again.", variant: "destructive" });
    } finally {
      setIsClaimPending(false);
    }
  };

  const raisedPercentage = (totalRaised / PRESALE_GOAL_USDC) * 100;

  return (
    <div 
      className="flex flex-col min-h-screen text-white"
      style={{
        backgroundColor: '#131313',
        backgroundImage: `url('/assets/images/banner.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="fixed bottom-4 right-4 flex gap-2">
        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">SOL</div>
        <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white">EX</div>
        <div className="h-10 w-10 rounded-full bg-blue-400 flex items-center justify-center text-white">TW</div>
        <div className="h-10 w-10 rounded-full bg-sky-500 flex items-center justify-center text-white">TG</div>
      </div>
      {/* Header */}
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

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-xl bg-gray-900/80 border-pink-500/30 backdrop-blur">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <img src="/assets/images/logo.png" alt="Happy Penis Logo" className="h-20 w-20" />
            </div>
            <CardTitle className="text-2xl text-center">
              Happy Penis Token Presale
            </CardTitle>
            <CardDescription className="text-center text-gray-300">
              Current Price: 1 PENIS = {currentTier.price_usdc} USDC
            </CardDescription>
            {/* Presale Ended Badge */}
            {presaleEnded && (
              <Badge variant="secondary" className="mx-auto mt-2 bg-pink-500 text-white">
                Presale Ended - Claim Your Tokens
              </Badge>
            )}
            {!presaleEnded && countdownTime && (
              <div className="text-center mt-2">
                <p className="text-xs text-gray-400">Presale ends in:</p>
                <p className="font-mono text-sm">{countdownTime}</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Wallet Info Section */}
            <div className="bg-gray-800/70 p-3 rounded-md text-xs">
              <div className="mb-2 font-medium text-pink-300">Project Details:</div>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <span className="text-gray-400">SPL Address: </span>
                  <span className="font-mono">{formatPublicKey(SPL_MINT_ADDRESS)}</span>
                </div>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.min(100, raisedPercentage).toFixed(2)}%</span>
              </div>
              <Progress value={Math.min(100, raisedPercentage)} className="h-2" />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{totalRaised.toLocaleString()} PENIS</span>
                <span>{PRESALE_GOAL_USDC.toLocaleString()} PENIS</span>
              </div>
            </div>
            {/* Tier Information */}
            <div className="bg-gray-800/70 p-3 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Current Tier: {currentTier.tier}</h3>
                  <p className="text-sm text-gray-400">Price: {currentTier.price_usdc} USDC</p>
                </div>
                {!presaleEnded && countdownTime && currentTier.tier > 3 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Tier ends in:</p>
                    <p className="font-mono">{countdownTime}</p>
                  </div>
                )}
              </div>
            </div>
            {/* Claim Section (visible when a wallet is connected) */}
            {connected && (
              <div className="bg-pink-500/20 p-4 rounded-md border border-pink-500">
                <h3 className="font-medium text-center mb-2">
                  {isCheckingStatus ? "Checking claim status..." : "Token Claim"}
                </h3>
                {isCheckingStatus ? (
                  <div className="flex justify-center py-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-pink-500"></div>
                  </div>
                ) : claimableTokens === null ? (
                  <p className="text-sm text-center">
                    Unable to check claim status
                  </p>
                ) : (
                  <>
                    {claimableTokens.total !== undefined && (
                      <p className="text-sm text-center mb-3">
                        You can claim <span className="font-bold">{parseInt(claimableTokens.total, 10).toLocaleString()}</span> PENIS tokens
                      </p>
                    )}
                    {presaleEnded && claimableTokens.canClaim ? (
                      <>
                        <Button
                          onClick={claimTokens}
                          disabled={isClaimPending}
                          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                        >
                          {isClaimPending ? "Processing..." : "Claim Tokens"}
                        </Button>
                        <p className="text-xs text-center mt-2 text-gray-300">
                          A small fee will be charged to process your claim
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-center">Claims open after the presale.</p>
                    )}
                  </>
                )}
              </div>
            )}
            {/* Purchase Form - Only show if presale hasn't ended */}
            {!presaleEnded && (
              <div className="space-y-4">
                <Tabs defaultValue="buy" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy">Buy Tokens</TabsTrigger>
                    <TabsTrigger value="tiers">Tier Info</TabsTrigger>
                  </TabsList>
                  <TabsContent value="buy" className="space-y-4 pt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Amount of PENIS tokens</Label>
                      <Input
                        id="amount"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        type="number"
                        min="1"
                        className="bg-gray-800/50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="token">Payment Token</Label>
                      <Select 
                        value={paymentToken} 
                        onValueChange={setPaymentToken}
                      >
                        <SelectTrigger className="bg-gray-800/50">
                          <SelectValue placeholder="Select token" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USDC">USDC</SelectItem>
                          <SelectItem value="SOL">SOL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={buyTokens} 
                      disabled={!connected || isPending || !amount}
                      className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                    >
                      {isPending ? "Processing..." : "Buy Now"}
                    </Button>
                    {!connected && (
                      <p className="text-center text-sm text-gray-400">
                        Connect your wallet to buy tokens
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="tiers" className="pt-4">
                    <div className="space-y-2">
                      {PRESALE_TIERS.map((tier) => (
                        <div 
                          key={tier.tier} 
                          className={`p-3 rounded-md border ${currentTier.tier === tier.tier ? 'bg-pink-500/20 border-pink-500' : 'bg-gray-800/50 border-gray-700'}`}
                        >
                          <div className="flex justify-between">
                            <h4 className="font-medium">Tier {tier.tier}</h4>
                            <span>{tier.price_usdc} USDC</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            <span>Limit: {tier.limit.toLocaleString()} PENIS</span>
                            {tier.duration_days && (
                              <span className="ml-2">Duration: {tier.duration_days} days</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      {/* Footer */}
      <footer className="py-4 text-center text-sm text-white bg-black/70">
        <img
          src="/assets/images/bag1.jpg"
          alt="Bag"
          className="mx-auto mb-2 h-12"
        />
        © 2025 Happy Penis Token. All rights reserved.
      </footer>
    </div>
  );
}

