// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SolanaProviders from "./providers/SolanaProviders";
import { assertEnv } from "./lib/env";

assertEnv(); // κάνε το νωρίς, πριν render

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SolanaProviders>
      <App />
    </SolanaProviders>
  </React.StrictMode>
);
