// src/lib/api.ts
const RAW = import.meta.env.VITE_API_BASE_URL as string;   // π.χ. https://happy-pennis.up.railway.app
if (!RAW) console.warn("[ENV] VITE_API_BASE_URL is empty");
const BASE = RAW.replace(/\/+$/, "");                      // κόψε τυχόν τελικά '/'

function url(path: string) {
  return path.startsWith("/") ? `${BASE}${path}` : `${BASE}/${path}`;
}

export async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000); // 15s timeout για να μη μένεις «λευκός»
  try {
    const res = await fetch(url(path), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      signal: ctrl.signal,
      // credentials: "include", // μόνο αν χρησιμοποιείς cookies
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API ${res.status} ${res.statusText} @ ${url(path)} ${txt ? "– " + txt : ""}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}


// Polling confirm + searchTransactionHistory: true για «άτρωτο» confirm
export async function confirmWithRetry(
  conn: Connection, signature: string,
  params: { blockhash: string; lastValidBlockHeight: number },
  opts?: { commitment?: Commitment; maxSeconds?: number; pollMs?: number }
): Promise<RpcResponseAndContext<SignatureResult>> {
  const commitment = opts?.commitment ?? "finalized";
  const pollMs     = opts?.pollMs ?? 1200;
  const deadline   = Date.now() + 1000 * (opts?.maxSeconds ?? Math.round(TX_TIMEOUT_MS / 1000));

  while (Date.now() < deadline) {
    try {
      const res = await conn.confirmTransaction({ signature, ...params }, commitment);
      if (res.value.err == null) return res;
    } catch {}
    await sleep(pollMs);
  }
  const st = (await conn.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
  if (st?.err == null && st?.confirmationStatus) {
    return { context: { apiVersion: undefined, slot: st.slot ?? 0 }, value: { err: null } };
  }
  throw new Error("Transaction not finalized within timeout");
}

// High-level helper — σε mobile προτιμάμε signAndSendTransaction
export async function signSendAndConfirm(
  wallet: {
    signAndSendTransaction?: (tx: VersionedTransaction) => Promise<{ signature: string }>;
    signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  },
  payer: PublicKey,
  ixs: TransactionInstruction[]
): Promise<string> {
  const conn = makeConnection();
  const tx = await buildV0Tx(payer, ixs, conn);

  if (wallet.signAndSendTransaction) {
    const { signature } = await wallet.signAndSendTransaction(tx);
    const bh = await conn.getLatestBlockhash(COMMITMENT);
    await confirmWithRetry(conn, signature, bh, { commitment: "finalized" });
    return signature;
  }

  const signed = wallet.signTransaction ? await wallet.signTransaction(tx) : tx;
  const sig = await conn.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
  const bh = await conn.getLatestBlockhash(COMMITMENT);
  await confirmWithRetry(conn, sig, bh, { commitment: "finalized" });
  return sig;
}
// --- ΒΑΛ' ΤΟ ΚΑΤΩ-ΚΑΤΩ ΣΤΟ src/lib/solana.ts (ή κοντά στα άλλα exports) ---

/** Συντομογραφεί ένα public key: ABCDEF...XYZ123 */
export function formatPublicKey(
  pk: string | import("@solana/web3.js").PublicKey,
  head = 6,
  tail = 6
): string {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

// (προαιρετικό) αν θες να μείνουν ίδια τα imports παλιού κώδικα:
export { SPL_MINT_ADDRESS } from "@/lib/env";

