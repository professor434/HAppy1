/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SOLANA_RPC_URL: string;
  readonly VITE_SOLANA_WS_URL: string; // optional αλλά το δηλώνουμε
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __CONF__?: { API_BASE_URL: string; RPC_HTTP: string; RPC_WS: string };
}
