// src/lib/env.ts
import { PublicKey } from "@solana/web3.js";

// Διαβάζουμε ΟΛΑ από import.meta.env (Vite)
export const VITE_API_BASE_URL   = (import.meta.env.VITE_API_BASE_URL   ?? "").replace(/\/+$/, "");
export const VITE_SOLANA_RPC_URL =  import.meta.env.VITE_SOLANA_RPC_URL ?? "";
export const VITE_SOLANA_WS_URL  =  import.meta.env.VITE_SOLANA_WS_URL  ?? "";
export const VITE_CANONICAL_URL  =  import.meta.env.VITE_CANONICAL_URL  ?? "";

// Γρήγορο UI: processed (confirmed/finalized τα χρησιμοποιούμε στο confirm)
export const COMMITMENT: "processed" | "confirmed" | "finalized" = "processed";
export const TX_TIMEOUT_MS = 90_000; // 90s για κινητά

// Public keys (όπως τα έχεις)
export const SPL_MINT_ADDRESS  = new PublicKey("GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs");
export const TREASURY_WALLET   = new PublicKey("6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD");
export const FEE_WALLET        = new PublicKey("J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn");
export const USDC_MINT_ADDRESS = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
