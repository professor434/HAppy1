import { useEffect, useState } from "react";
import type { TierInfo } from "@/lib/api";

interface Props {
  currentTier: TierInfo;
  label?: string;
  className?: string;
}

export default function CountdownTimer({ currentTier, label = "Presale ends in:", className }: Props) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    if (currentTier.tier <= 3) {
      setTime("No time limit - Complete sale to advance");
      return;
    }
    const tierStartDate = new Date("2025-08-01");
    const tierEndDate = new Date(tierStartDate);
    const duration = currentTier.duration_days || 30;
    tierEndDate.setDate(tierEndDate.getDate() + duration);

    const update = () => {
      const diff = tierEndDate.getTime() - Date.now();
      if (diff <= 0) {
        setTime("Tier ended");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime(`${d}d ${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [currentTier]);

  if (!time) return null;

  return (
    <div className={className}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-mono text-sm">{time}</p>
    </div>
  );
}
