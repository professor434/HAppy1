import { toast } from 'sonner';

// Base URL for API - would come from environment in production
const API_BASE_URL = 'http://localhost:3001';

// Define interfaces for API responses
interface PurchaseRecord {
  wallet: string;
  token: string;
  amount: number;
  total: string;
  fee: string;
  tier: number;
  transaction_signature: string;
  timestamp: string;
  claimed: boolean;
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
}

interface ClaimStatus {
  canClaim: boolean;
  total?: string;
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
  transaction_signature: string
): Promise<PurchaseRecord | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, amount, token, transaction_signature })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to record purchase');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    toast.error('Failed to record purchase', {
      description: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return null;
  }
}

/**
 * Get current tier information
 */
export async function getCurrentTier(): Promise<TierInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/tiers`);
    if (!response.ok) {
      throw new Error('Failed to fetch tier information');
    }
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    return null;
  }
}

/**
 * Check if a wallet can claim tokens
 */
export async function canClaimTokens(wallet: string): Promise<ClaimStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/can-claim/${wallet}`);
    if (!response.ok) {
      throw new Error('Failed to check claim status');
    }
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    return { canClaim: false };
  }
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
    if (!response.ok) {
      throw new Error('Failed to fetch presale status');
    }
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
    if (!response.ok) {
      throw new Error('Failed to fetch snapshot data');
    }
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