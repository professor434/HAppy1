import type { TierInfo } from "@/lib/api";

interface Props {
  tiers: TierInfo[];
  currentTier: TierInfo;
}

export default function TierInfoList({ tiers, currentTier }: Props) {
  return (
    <div className="space-y-2">
      {tiers.map((tier) => (
        <div
          key={tier.tier}
          className={`p-3 rounded-md border ${
            currentTier.tier === tier.tier
              ? "bg-pink-500/20 border-pink-500"
              : "bg-gray-800/50 border-gray-700"
          }`}
        >
          <div className="flex justify-between">
            <h4 className="font-medium">Tier {tier.tier}</h4>
            <span>{tier.price_usdc} USDC</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            <span>Limit: {tier.max_tokens.toLocaleString()} PENIS</span>
            {tier.duration_days && (
              <span className="ml-2">Duration: {tier.duration_days} days</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
