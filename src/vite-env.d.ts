/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_SOLANA_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    lastTransactionSignature?: string
    __CONF__?: any
  }
}
export {}
