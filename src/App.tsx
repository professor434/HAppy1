// ΠΡΕΠΕΙ να φορτώνει πρώτο για να υπάρχει Buffer στον browser
import "@/buffer-polyfill";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import MobileOpenInWallet from "@/components/MobileOpenInWallet";

import "@solana/wallet-adapter-react-ui/styles.css";
import React from "react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WalletModalProvider>
        <Toaster />
        <BrowserRouter>
          {/* Banner για κινητά αν δεν είναι ήδη μέσα σε wallet browser */}
          <MobileOpenInWallet />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </WalletModalProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
