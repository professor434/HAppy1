import { toast } from 'sonner';

// Base URL for API - configured via environment for production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Define interfaces for API responses
interface PurchaseRecord {
  id: number;
  wallet: string;
  token: string;
  amount: number;
  tier: number;
  transaction_signature: string;
  timestamp: string;
  claimed: boolean;
  total_paid_usdc: number | null;
  total_paid_sol: number | null;
  fee_paid_usdc: number | null;
  fee_paid_sol: number | null;
  price_usdc_each: number;
}

interface TierInfo {
  tier: number;
  price_usdc: number;
  max_tokens: number;
  duration_days?: number;
}

interface PresaleStatus {
  raised: number;
  currentTier: TierInfo;
  totalPurchases: number;
  totalClaims: number;
  spl_address: string;
  fee_wallet: string;
  presaleEnded?: boolean;
}

interface ClaimStatus {
  canClaim: boolean;
  total?: string;
}

interface WalletClaimStatus extends ClaimStatus {
  wallet: string;
}

interface ClaimResponse {
  success: boolean;
}

/**
 * Record a purchase in the snapshot
 */
export async function recordPurchase(
  wallet: string,
  amount: number,
  token: string,
  transaction_signature: string,
  extras?: { total_paid_usdc?: number | null; total_paid_sol?: number | null; fee_paid_usdc?: number | null; fee_paid_sol?: number | null }
): Promise<PurchaseRecord | null> {
  const body = JSON.stringify({ wallet, amount, token, transaction_signature, ...extras });
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${API_BASE_URL}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'include'
      });
      if (r.ok) return await r.json();
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}

/**
 * Get current tier information
 */
export async function getCurrentTier(): Promise<TierInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/tiers`);
    if (!response.ok) throw new Error('Failed to fetch tier information');
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    return null;
  }
}

/**
 * Check claimable tokens for multiple wallets
 */
export async function canClaimTokensBulk(wallets: string[]): Promise<WalletClaimStatus[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/can-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallets })
    });
    if (!response.ok) throw new Error('Failed to check claim status');
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    return wallets.map(wallet => ({ wallet, canClaim: false }));
  }
}

/**
 * Check if a wallet can claim tokens
 */
export async function canClaimTokens(wallet: string): Promise<ClaimStatus> {
  const [result] = await canClaimTokensBulk([wallet]);
  return result ?? { canClaim: false };
}

/**
 * Record a token claim
 */
export async function recordClaim(wallet: string, transaction_signature: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, transaction_signature })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to record claim');
    }
    return (await response.json() as ClaimResponse).success;
  } catch (error) {
    console.error('API error:', error);
    toast.error('Failed to record claim', {
      description: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return false;
  }
}

/**
 * Get current status of the presale
 */
export async function getPresaleStatus(): Promise<PresaleStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/status`);
    if (!response.ok) throw new Error('Failed to fetch presale status');
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    return null;
  }
}

/**
 * Get snapshot data (for admin purposes)
 */
export async function getSnapshot(): Promise<PurchaseRecord[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/snapshot`);
    if (!response.ok) throw new Error('Failed to fetch snapshot data');
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    return [];
  }
}

/**
 * Download snapshot as CSV
 */
export function downloadSnapshotCSV(): void {
  window.open(`${API_BASE_URL}/export`, '_blank');
}
