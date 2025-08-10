// Import Buffer polyfill first before any other imports
import './buffer-polyfill.ts';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import SolanaProviders from './providers/SolanaProviders';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SolanaProviders>
      <App />
    </SolanaProviders>
  </React.StrictMode>
);
