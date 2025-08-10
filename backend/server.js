
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";


// --- ESM boilerplate
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 8080;

// --- Project constants
const SPL_MINT_ADDRESS = "GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs";
const TREASURY_WALLET  = "6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD";
const FEE_WALLET       = "J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn";
const short = (w = "") => String(w).slice(0, 6) + "...";


// --- Paths (Railway volume)
const DATA_DIR        = process.env.DATA_DIR || "/data";
const FILE_PURCHASES  = path.join(DATA_DIR, "purchases.json");
const FILE_CLAIMS     = path.join(DATA_DIR, "claims.json");
const MIGRATION_SENTINEL = path.join(DATA_DIR, ".fix_fees_done");


await fs.mkdir(DATA_DIR, { recursive: true });

// --- Migrate legacy ./data/* once and bootstrap files
async function migrateIfNeeded() {
  const legacyDir = path.join(process.cwd(), "data");
  try {
    const body = await fs.readFile(path.join(legacyDir, "purchases.json"), "utf8");
    await fs.writeFile(FILE_PURCHASES, body, { flag: "wx" }).catch(() => {});
  } catch {}
  try {
    const body = await fs.readFile(path.join(legacyDir, "claims.json"), "utf8");
    await fs.writeFile(FILE_CLAIMS, body, { flag: "wx" }).catch(() => {});
  } catch {}
  try { await fs.access(FILE_PURCHASES); } catch { await fs.writeFile(FILE_PURCHASES, JSON.stringify({ purchases: [] }, null, 2)); }
  try { await fs.access(FILE_CLAIMS);    } catch { await fs.writeFile(FILE_CLAIMS,    JSON.stringify({ claims: [] }, null, 2)); }
}
await migrateIfNeeded();

// --- In-memory state
let purchases = [];
let claims    = [];

// --- I/O helpers (atomic writes)
async function loadData() {
  try {
    const rawP = JSON.parse(await fs.readFile(FILE_PURCHASES, "utf8"));
    purchases = Array.isArray(rawP) ? rawP : (rawP.purchases || []);
  } catch { purchases = []; }
  try {
    const rawC = JSON.parse(await fs.readFile(FILE_CLAIMS, "utf8"));
    claims = Array.isArray(rawC) ? rawC : (rawC.claims || []);
  } catch { claims = []; }
}
async function saveData() {
  const tmpP = FILE_PURCHASES + ".tmp";
  await fs.writeFile(tmpP, JSON.stringify({ purchases }, null, 2));
  await fs.rename(tmpP, FILE_PURCHASES);
  const tmpC = FILE_CLAIMS + ".tmp";
  await fs.writeFile(tmpC, JSON.stringify({ claims }, null, 2));
  await fs.rename(tmpC, FILE_CLAIMS);
}

// --- Serialize writes
let writing = Promise.resolve();
const queue = (fn) => (writing = writing.then(fn, fn));

// --- CORS & body parser
const allowed = new Set([
  "https://presale-happypenis.com",
  "https://www.presale-happypenis.com",
  "https://happypennisofficialpresale.vercel.app",
  "http://localhost:3000",
]);
app.use(cors({ origin: (o, cb) => cb(null, !o || allowed.has(o)), credentials: true }));
app.options("*", cors());
app.use(express.json());

// --- Presale tiers (file next to server.js)
async function loadTiers() {
  try {
    const tiersData = await fs.readFile(path.join(__dirname, "presale_tiers.json"), "utf8");
    return JSON.parse(tiersData);
  } catch (e) {
    console.error("❌ Error loading presale tiers:", e);
    return [];
  }
}
let presaleTiers = [];
let currentTierIndex = 0;

async function initializeData() {
  presaleTiers = await loadTiers();
  await loadData();
  console.log(`✅ Loaded ${presaleTiers.length} presale tiers`);
}
function calculateTotalRaised() {
  return purchases.reduce((sum, p) => sum + Number(p.amount || 0), 0);
}
function updateCurrentTier() {
  const total = calculateTotalRaised();
  let acc = 0;
  for (let i = 0; i < presaleTiers.length; i++) {
    const t = presaleTiers[i];
    if (acc + t.max_tokens > total) { currentTierIndex = i; return; }
    acc += t.max_tokens;
  }
  currentTierIndex = Math.max(0, presaleTiers.length - 1);
}

// ----------------- ROUTES -----------------
l

// Root & health
app.get("/", (req, res) => res.send("Happy Penis API ✓"));
app.get("/healthz", (req, res) => res.json({ ok: true, time: Date.now() }));


// Current tier
app.get("/tiers", async (req, res) => {
  if (presaleTiers.length === 0) await initializeData();
  updateCurrentTier();
  res.json(presaleTiers[currentTierIndex]);
});

// Status
app.get("/status", (req, res) => {
  updateCurrentTier();
  res.json({
    raised: calculateTotalRaised(),
    currentTier: presaleTiers[currentTierIndex],
    totalPurchases: purchases.length,
    totalClaims: claims.length,
    spl_address: SPL_MINT_ADDRESS,
    fee_wallet: FEE_WALLET,
  });
});

// BUY — idempotent + σωστή αποθήκευση SOL/USDC
app.post("/buy", async (req, res) => {
  const b = req.is("application/json") ? req.body : JSON.parse(req.body || "{}");
  const {
    wallet,
    amount,
    token,
    transaction_signature,
    total_paid_usdc,
    total_paid_sol,
    fee_paid_usdc,
    fee_paid_sol,
    price_usdc_each,
  } = b || {};

  if (!wallet || !amount || !token || !transaction_signature) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!["SOL", "USDC"].includes(token)) {
    return res.status(400).json({ error: "Invalid token" });
  }

  const userAgent = req.get("user-agent") || "";

  await queue(async () => {
    await loadData();
    const existing = purchases.find((p) => p.transaction_signature === transaction_signature);
    if (existing) { res.json(existing); return; }

    updateCurrentTier();
    const currentTier = presaleTiers[currentTierIndex] || { price_usdc: 0.00026, tier: 1 };
    const isSOL  = token === "SOL";
    const isUSDC = token === "USDC";

    const purchase = {
      id: purchases.length + 1,
      wallet: String(wallet).trim(),
      token,
      amount: Number(amount),
      tier: currentTier.tier,
      transaction_signature,
      timestamp: new Date().toISOString(),
      claimed: false,

      price_usdc_each: Number(price_usdc_each ?? currentTier?.price_usdc ?? 0.00026),


      // ΓΕΜΙΖΟΥΝ ΜΟΝΟ ΤΑ ΠΕΔΙΑ ΤΟΥ ΝΟΜΙΣΜΑΤΟΣ ΠΛΗΡΩΜΗΣ
      total_paid_sol : isSOL  ? Number(total_paid_sol  ?? 0) : 0,
      fee_paid_sol   : isSOL  ? Number(fee_paid_sol    ?? 0) : 0,
      total_paid_usdc: isUSDC ? Number(total_paid_usdc ?? 0) : 0,
      fee_paid_usdc  : isUSDC ? Number(fee_paid_usdc   ?? 0) : 0,


      user_agent: userAgent,
    };

    // Ασφάλεια: καθάρισε τυχόν ανάμικτα πεδία
    if (isSOL)  { purchase.total_paid_usdc = 0; purchase.fee_paid_usdc = 0; }
    if (isUSDC) { purchase.total_paid_sol  = 0; purchase.fee_paid_sol  = 0; }

    purchases.push(purchase);
    await saveData();

    const feeStr = isSOL ? `fee(sol)=${purchase.fee_paid_sol}` : `fee(usdc)=${purchase.fee_paid_usdc}`;
    console.log(`🛒 Purchase: ${purchase.amount} PENIS by ${short(purchase.wallet)}, ${feeStr} ua=${userAgent}`);
    res.json(purchase);
  }).catch((e) => { console.error("write-error", e); res.status(500).json({ error: "STORE_FAILED" }); });
});

// can-claim (single wallet)
app.get("/can-claim/:wallet", async (req, res) => {
  const { wallet } = req.params;
  await loadData();
  const list = purchases.filter((p) => p.wallet === wallet);
  const totalTokens = list.reduce((s, p) => s + Number(p.amount || 0), 0);
  const anyClaimed  = list.some((p) => p.claimed);
  res.json({ canClaim: totalTokens > 0 && !anyClaimed, total: totalTokens > 0 ? String(totalTokens) : undefined });
});

// can-claim bulk
app.post("/can-claim", async (req, res) => {
  const wallets = (req.body && req.body.wallets) || [];
  const userAgent = req.get("user-agent") || "";
  console.log("📦 /can-claim raw body:", { wallets, userAgent });

  await loadData();
  const out = wallets.map((w) => {
    const ww   = String(w).trim();
    const list = purchases.filter((p) => p.wallet === ww);
    if (list.length === 0) console.log("🔍 /can-claim checked wallet with no purchases:", ww);
    const total = list.reduce((s, p) => s + Number(p.amount || 0), 0);
    const anyClaimed = list.some((p) => p.claimed);
    return { wallet: ww, canClaim: total > 0 && !anyClaimed, total: total || undefined };
  });
  res.json(out);
});

// claim (single-claim ανά wallet)
app.post("/claim", async (req, res) => {
  const { wallet, transaction_signature } = req.body || {};
  const userAgent = req.get("user-agent") || "";

  if (!wallet || !transaction_signature) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  await queue(async () => {
    await loadData();
    const userPurchases = purchases.filter((p) => p.wallet === wallet);
    const anyClaimed = userPurchases.some((p) => p.claimed);
    if (anyClaimed) { res.status(400).json({ error: "Tokens already claimed" }); return; }

    const totalTokens = userPurchases.reduce((s, p) => s + Number(p.amount || 0), 0);
    if (totalTokens <= 0) { res.status(400).json({ error: "No tokens to claim" }); return; }

    userPurchases.forEach((p) => {
      const idx = purchases.findIndex((x) => x.id === p.id);
      if (idx !== -1) purchases[idx].claimed = true;
    });

    const claim = {
      id: claims.length + 1,
      wallet,
      total_tokens: totalTokens,
      transaction_signature,
      timestamp: new Date().toISOString(),
      user_agent: userAgent,
    };
    claims.push(claim);

    await saveData();
    console.log(`🎉 Claimed: ${totalTokens} tokens by ${short(wallet)}, ua=${userAgent}`);
    res.json({ success: true });
  }).catch((e) => { console.error("write-error", e); res.status(500).json({ error: "STORE_FAILED" }); });
});

// --- Debug
app.get("/debug/where", async (req, res) => {
  await loadData();
  res.json({ file: FILE_PURCHASES, count: purchases.length });
});
app.get("/debug/list", async (req, res) => {
  await loadData();
  res.json(purchases.slice(-10));
});
app.get("/snapshot", (req, res) => res.json(purchases));

// Export CSV (με fees & price)
app.get("/export", (req, res) => {
  const header = [
    "id","wallet","token","amount","tier",
    "transaction_signature","timestamp","claimed",
    "total_paid_usdc","total_paid_sol",
    "fee_paid_usdc","fee_paid_sol",
    "price_usdc_each"
  ].join(",") + "\n";

  const rows = purchases.map(p => ([
    p.id, p.wallet, p.token, p.amount, p.tier,
    p.transaction_signature, p.timestamp, p.claimed,
    p.total_paid_usdc ?? "", p.total_paid_sol ?? "",
    p.fee_paid_usdc ?? "",  p.fee_paid_sol ?? "",
    p.price_usdc_each ?? ""
  ].join(","))).join("\n");

  res.setHeader("Content-Disposition", "attachment; filename=presale_snapshot.csv");
  res.setHeader("Content-Type", "text/csv");
  res.send(header + rows);
});

// --- One-time cleanup: fix wrong fee fields & normalize numbers

app.get("/debug/migration-status", async (req, res) => {

  try { await fs.access(MIGRATION_SENTINEL); res.json({ done: true }); }
  catch { res.json({ done: false }); }
});


// --- helper: μία φορά και τέλος

async function runFixFeesOnce() {
  try { await fs.access(MIGRATION_SENTINEL); return { ok: true, alreadyRun: true }; } catch {}
  await loadData();
  let changed = 0;
  for (const p of purchases) {

    p.wallet = String(p.wallet||"").trim();
    p.token  = (p.token === "USDC") ? "USDC" : "SOL";
    p.amount = Number(p.amount||0);
    p.tier   = Number(p.tier||1);
    p.price_usdc_each = Number(p.price_usdc_each||0.00026);
    if (p.token === "SOL") {

      if (Number(p.total_paid_usdc)) { p.total_paid_usdc = 0; changed++; }
      if (Number(p.fee_paid_usdc))   { p.fee_paid_usdc   = 0; changed++; }
      p.total_paid_sol = Number(p.total_paid_sol||0);
      p.fee_paid_sol   = Number(p.fee_paid_sol||0);
    } else {
      if (Number(p.total_paid_sol)) { p.total_paid_sol = 0; changed++; }
      if (Number(p.fee_paid_sol))   { p.fee_paid_sol   = 0; changed++; }
      p.total_paid_usdc = Number(p.total_paid_usdc||0);
      p.fee_paid_usdc   = Number(p.fee_paid_usdc||0);
    }
  }
  await saveData();

  await fs.writeFile(MIGRATION_SENTINEL, new Date().toISOString(), "utf8");
  return { ok: true, changed, total: purchases.length };
}

// υπάρχον POST (μένει ως έχει)
app.post("/debug/fix-fees-once", async (req, res) => {
  try { res.json(await runFixFeesOnce()); }
  catch (e) { console.error(e); res.status(500).json({ ok:false, error:String(e) }); }
});

// νέο alias GET για ευκολία (τρέχει την ίδια λογική)
app.get("/debug/fix-fees-once", async (req, res) => {
  try { res.json(await runFixFeesOnce()); }
  catch (e) { console.error(e); res.status(500).json({ ok:false, error:String(e) }); }
});

// --- Start

(async () => {
  await initializeData();
  app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
})();
