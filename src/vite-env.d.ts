/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_CANONICAL_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __CONF__?: { API_BASE_URL: string };
}
