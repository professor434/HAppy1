import "./buffer-polyfill";
import { assertEnv } from "./lib/env";

// Δείξε ξεκάθαρα τι βλέπει ο client από τα VITE_*:
console.log("[ENV]", {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_SOLANA_RPC_URL: import.meta.env.VITE_SOLANA_RPC_URL,
  VITE_SOLANA_WS_URL: import.meta.env.VITE_SOLANA_WS_URL,
  VITE_CANONICAL_URL: import.meta.env.VITE_CANONICAL_URL,
});
assertEnv();


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SolanaProviders>
      <App />
    </SolanaProviders>
  </React.StrictMode>
);
