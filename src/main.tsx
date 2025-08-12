// src/main.tsx
import "./buffer-polyfill";   // πριν από Ο,ΤΙΔΗΠΟΤΕ (διορθώνει Buffer για libs)
import "./index.css";         // global styles
import "./App.css";           // app-level styles

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SolanaProviders from "./providers/SolanaProviders";
import { assertEnv } from "./lib/env";

assertEnv();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SolanaProviders>
      <App />
    </SolanaProviders>
  </React.StrictMode>
);
