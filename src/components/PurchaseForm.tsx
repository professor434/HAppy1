import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentToken } from "@/lib/api";

interface Props {
  amount: string;
  setAmount: (v: string) => void;
  paymentToken: PaymentToken;
  setPaymentToken: (v: PaymentToken) => void;
  buyTokens: () => void;
  isPending: boolean;
  connected: boolean;
  /** optional limits so δεν “κρασάρει” αν λείπουν */
  minBuy?: number;
  maxBuy?: number;
}

export default function PurchaseForm({
  amount,
  setAmount,
  paymentToken,
  setPaymentToken,
  buyTokens,
  isPending,
  connected,
  minBuy = 1,
  maxBuy = 1_000_000,
}: Props) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="amount">Amount of PENIS tokens</Label>
        <Input
          id="amount"
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={minBuy}
          max={maxBuy}
          step="1"
          className="bg-gray-800/50 text-pink-500 font-bold placeholder-pink-400"
          placeholder={`${minBuy} - ${maxBuy}`}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="token">Payment Token</Label>
        <Select
          value={paymentToken}
          onValueChange={(v) => setPaymentToken(v as PaymentToken)}
        >
          <SelectTrigger
            id="token"
            className="bg-gray-800/50 text-pink-500 font-bold border-pink-500/30 focus:ring-0 focus:outline-none focus:border-pink-500"
          >
            <SelectValue placeholder="Select token" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 text-pink-500 font-bold border border-pink-500/30">
            <SelectItem
              value="USDC"
              className="text-pink-500 font-bold data-[highlighted]:bg-pink-500/10 data-[state=checked]:text-pink-600"
            >
              USDC
            </SelectItem>
            <SelectItem
              value="SOL"
              className="text-pink-500 font-bold data-[highlighted]:bg-pink-500/10 data-[state=checked]:text-pink-600"
            >
              SOL
            </SelectItem>
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
    </>
  );
}
