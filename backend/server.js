import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM boilerplate
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Wallets / constants
const SPL_MINT_ADDRESS = 'GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs';
const TREASURY_WALLET  = '6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD';
const FEE_WALLET       = 'J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn';

// CORS (πρόσθεσα presale-happypenis.com και localhost)
const allowedOrigins = (process.env.CORS_ORIGIN || 
  'https://happypennisofficialpresale.vercel.app,https://presale-happypenis.com,http://localhost:3000'
).split(',').map(o => o.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.options('*', cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// In-memory + persistent store
let purchases = [];
let claims    = [];

const DATA_DIR       = path.join(__dirname, '..', 'data');
const PURCHASES_FILE = path.join(DATA_DIR, 'purchases.json');
const CLAIMS_FILE    = path.join(DATA_DIR, 'claims.json');

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
}
async function loadData() {
  try { purchases = JSON.parse(await fs.readFile(PURCHASES_FILE, 'utf8')); } catch { purchases = []; }
  try { claims    = JSON.parse(await fs.readFile(CLAIMS_FILE, 'utf8')); } catch { claims    = []; }
}
async function saveData() {
  await ensureDataDir();
  await fs.writeFile(PURCHASES_FILE, JSON.stringify(purchases, null, 2));
  await fs.writeFile(CLAIMS_FILE, JSON.stringify(claims, null, 2));
}

// Load tiers from file next to server.js
async function loadTiers() {
  try {
    const tiersData = await fs.readFile(path.join(__dirname, 'presale_tiers.json'), 'utf8');
    return JSON.parse(tiersData);
  } catch (e) {
    console.error('❌ Error loading presale tiers:', e);
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

// === ROUTES ===

// current tier
app.get('/tiers', async (req, res) => {
  if (presaleTiers.length === 0) await initializeData();
  updateCurrentTier();
  res.json(presaleTiers[currentTierIndex]);
});

// status
app.get('/status', (req, res) => {
  updateCurrentTier();
  res.json({
    raised: calculateTotalRaised(),
    currentTier: presaleTiers[currentTierIndex],
    totalPurchases: purchases.length,
    totalClaims: claims.length,
    spl_address: SPL_MINT_ADDRESS,
    fee_wallet: FEE_WALLET,
    // presaleEnded: false, // αν θέλεις να το ελέγχεις από εδώ
  });
});

// buy (idempotent + ρητά ποσά/fees)
app.post('/buy', async (req, res) => {
  const {
    wallet,
    amount,                  // PENIS tokens
    token,                   // "SOL" | "USDC"
    transaction_signature,

    // προαιρετικά από frontend για ακριβές logging
    total_paid_usdc,
    total_paid_sol,
    fee_paid_usdc,
    fee_paid_sol
  } = req.body;

  if (!wallet || !amount || !token || !transaction_signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (token !== 'SOL' && token !== 'USDC') {
    return res.status(400).json({ error: 'Invalid token' });
  }

  // Idempotency: μην ξαναγράψεις ίδια αγορά
  const existing = purchases.find(p => p.transaction_signature === transaction_signature);
  if (existing) return res.json(existing);

  updateCurrentTier();
  const currentTier = presaleTiers[currentTierIndex];

  // fallback αν δεν ήρθαν τα ρητά ποσά από το frontend
  const BUY_FEE_PCT = 0.4; // %
  const computed_total_usdc = Number(amount) * Number(currentTier.price_usdc);
  const computed_fee_usdc   = computed_total_usdc * (BUY_FEE_PCT / 100);

  const purchase = {
    id: purchases.length + 1,
    wallet,
    token,
    amount: Number(amount),
    tier: currentTier.tier,
    transaction_signature,
    timestamp: new Date().toISOString(),
    claimed: false,

    total_paid_usdc: (total_paid_usdc ?? Number(computed_total_usdc.toFixed(6))),
    total_paid_sol:  (total_paid_sol  ?? null),
    fee_paid_usdc:   (fee_paid_usdc   ?? Number(computed_fee_usdc.toFixed(6))),
    fee_paid_sol:    (fee_paid_sol    ?? null),

    price_usdc_each: Number(currentTier.price_usdc),
  };

  purchases.push(purchase);
  await saveData();
  console.log(`🛒 Purchase: ${amount} PENIS by ${wallet.slice(0,6)}..., fee(usdc)=${purchase.fee_paid_usdc ?? '-'} fee(sol)=${purchase.fee_paid_sol ?? '-'}`);
  res.json(purchase);
});

// can-claim (single wallet - retained for compatibility)
app.get('/can-claim/:wallet', (req, res) => {
  const { wallet } = req.params;
  const userPurchases = purchases.filter(p => p.wallet === wallet);
  const totalTokens = userPurchases.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const anyClaimed = userPurchases.some(p => p.claimed);
  res.json({
    canClaim: totalTokens > 0 && !anyClaimed,
    total: totalTokens > 0 ? String(totalTokens) : undefined,
  });
});

// can-claim bulk
app.post('/can-claim', (req, res) => {
  const wallets = Array.isArray(req.body) ? req.body : req.body?.wallets;
  if (!Array.isArray(wallets)) {
    return res.status(400).json({ error: 'wallets must be an array' });
  }
  const results = wallets.map(wallet => {
    const userPurchases = purchases.filter(p => p.wallet === wallet);
    const totalTokens = userPurchases.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const anyClaimed = userPurchases.some(p => p.claimed);
    return {
      wallet,
      canClaim: totalTokens > 0 && !anyClaimed,
      total: totalTokens > 0 ? String(totalTokens) : undefined,
    };
  });
  res.json(results);
});

// claim (single-claim ανά wallet)
app.post('/claim', async (req, res) => {
  const { wallet, transaction_signature } = req.body;
  if (!wallet || !transaction_signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const userPurchases = purchases.filter(p => p.wallet === wallet);
  const anyClaimed = userPurchases.some(p => p.claimed);
  if (anyClaimed) return res.status(400).json({ error: 'Tokens already claimed' });

  const totalTokens = userPurchases.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  if (totalTokens <= 0) return res.status(400).json({ error: 'No tokens to claim' });

  // μαρκάρουμε ως claimed
  userPurchases.forEach(p => {
    const idx = purchases.findIndex(x => x.id === p.id);
    if (idx !== -1) purchases[idx].claimed = true;
  });

  const claim = {
    id: claims.length + 1,
    wallet,
    total_tokens: totalTokens,
    transaction_signature,
    timestamp: new Date().toISOString(),
  };
  claims.push(claim);

  await saveData();
  console.log(`🎉 Claimed: ${totalTokens} tokens by ${wallet.slice(0,6)}...`);
  res.json({ success: true });
});

// snapshot
app.get('/snapshot', (req, res) => {
  res.json(purchases);
});

// export CSV (με fees & price)
app.get('/export', (req, res) => {
  const header = [
    'id','wallet','token','amount','tier',
    'transaction_signature','timestamp','claimed',
    'total_paid_usdc','total_paid_sol',
    'fee_paid_usdc','fee_paid_sol',
    'price_usdc_each'
  ].join(',') + '\n';

  const rows = purchases.map(p => ([
    p.id, p.wallet, p.token, p.amount, p.tier,
    p.transaction_signature, p.timestamp, p.claimed,
    p.total_paid_usdc ?? '', p.total_paid_sol ?? '',
    p.fee_paid_usdc ?? '',  p.fee_paid_sol ?? '',
    p.price_usdc_each ?? ''
  ].join(','))).join('\n');

  res.setHeader('Content-Disposition', 'attachment; filename=presale_snapshot.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(header + rows);
});

// start
(async () => {
  await initializeData();
  app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
})();
