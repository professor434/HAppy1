/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_RPC_URL?: string
  readonly VITE_SOLANA_WS_URL?: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  lastTransactionSignature?: string;
}