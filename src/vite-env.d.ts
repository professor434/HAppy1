/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;

  readonly VITE_API_BASE_URL?: string;

  // RPC / WS
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_SOLANA_WS_URL?: string;

  // On-chain / ρυθμίσεις presale
  readonly VITE_SPL_MINT_ADDRESS?: string;
  readonly VITE_TREASURY_WALLET?: string;
  readonly VITE_FEE_WALLET?: string;
  readonly VITE_BUY_FEE_PERCENTAGE?: string; // number as string
  readonly VITE_CLAIM_FEE_SOL?: string;      // number as string

  // Redirect μετά το connect
  readonly VITE_PROD_URL?: string;

  // (προαιρετικά aliases που υπήρχαν σε παλιό κώδικα)
  readonly VITE_SOLANA_RPC_HTTP?: string;
  readonly VITE_SOLANA_RPC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __CONF__?: { API_BASE_URL: string; RPC_HTTP: string; RPC_WS: string };
}
