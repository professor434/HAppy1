import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaymentToken } from "@/lib/api";

interface Props {
  amount: string;
  setAmount: (v: string) => void;
  paymentToken: PaymentToken;
  setPaymentToken: (v: PaymentToken) => void;
  buyTokens: () => void;
  isPending: boolean;
  connected: boolean;
}

export default function PurchaseForm({
  amount,
  setAmount,
  paymentToken,
  setPaymentToken,
  buyTokens,
  isPending,
  connected,
}: Props) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="amount">Amount of PENIS tokens</Label>
       <Input
  type="number"
  inputMode="numeric"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  min={minBuy}
  max={maxBuy}
  step="1"
  className="bg-gray-800/50 text-pink-500 font-bold placeholder-pink-400"
/>

      </div>
      <div className="grid gap-2">
        <Label htmlFor="token">Payment Token</Label>
        <Select value={paymentToken} onValueChange={(v: PaymentToken) => setPaymentToken(v)}>
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
        <p className="text-center text-sm text-gray-400">Connect your wallet to buy tokens</p>
      )}
    </>
  );
}
