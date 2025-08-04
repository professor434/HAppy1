import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Διάφορες αρχικοποιήσεις για ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Σταθερές για τα wallets/tokens (όπως πριν)
const SPL_MINT_ADDRESS = 'GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs';
const TREASURY_WALLET  = '6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD';
const FEE_WALLET       = 'J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn';

// CORS για παραγωγή + localhost
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// In-memory store με επίμονη αποθήκευση
let purchases = [];
let claims    = [];

// Διαδρομές για τα αρχεία δεδομένων
const DATA_DIR      = path.join(__dirname, 'data');
const PURCHASES_FILE = path.join(DATA_DIR, 'purchases.json');
const CLAIMS_FILE    = path.join(DATA_DIR, 'claims.json');

// Βοηθητικές συναρτήσεις για δημιουργία φακέλου /data, φόρτωση και αποθήκευση
async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
}

async function loadData() {
  try {
    purchases = JSON.parse(await fs.readFile(PURCHASES_FILE, 'utf8'));
  } catch {
    purchases = [];
  }
  try {
    claims = JSON.parse(await fs.readFile(CLAIMS_FILE, 'utf8'));
  } catch {
    claims = [];
  }
}

async function saveData() {
  await ensureDataDir();
  await fs.writeFile(PURCHASES_FILE, JSON.stringify(purchases, null, 2));
  await fs.writeFile(CLAIMS_FILE, JSON.stringify(claims, null, 2));
}

// Φόρτωση presale tiers από αρχείο JSON
async function loadTiers() {
  try {
    const tiersData = await fs.readFile(path.join(__dirname, 'presale_tiers.json'), 'utf8');
    return JSON.parse(tiersData);
  } catch (error) {
    console.error('❌ Error loading presale tiers:', error);
    return [];
  }
}

let presaleTiers = [];
let currentTierIndex = 0;

// Εκκίνηση: φορτώνουμε tiers και προηγούμενα purchases/claims
async function initializeData() {
  presaleTiers = await loadTiers();
  await loadData();
  console.log(`✅ Loaded ${presaleTiers.length} presale tiers`);
}

// Υπολογισμός συνολικών αγορασμένων tokens
function calculateTotalRaised() {
  return purchases.reduce((total, purchase) => total + purchase.amount, 0);
}

// Ενημέρωση τρέχοντος presale tier ανάλογα με τα tokens
function updateCurrentTier() {
  const totalRaised = calculateTotalRaised();
  let raisedSoFar = 0;
  for (let i = 0; i < presaleTiers.length; i++) {
    const tier = presaleTiers[i];
    if (raisedSoFar + tier.max_tokens > totalRaised) {
      currentTierIndex = i;
      return;
    }
    raisedSoFar += tier.max_tokens;
  }
  currentTierIndex = presaleTiers.length - 1;
}

// === ROUTES ===

// Επιστρέφει το τρέχον presale tier
app.get('/tiers', async (req, res) => {
  if (presaleTiers.length === 0) await initializeData();
  updateCurrentTier();
  res.json(presaleTiers[currentTierIndex]);
});

// Στατιστικά προόδου
app.get('/status', (req, res) => {
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

// Καταγραφή αγοράς
app.post('/buy', async (req, res) => {
  const { wallet, amount, token, transaction_signature } = req.body;
  if (!wallet || !amount || !token || !transaction_signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  updateCurrentTier();
  const currentTier = presaleTiers[currentTierIndex];
  const purchase = {
    id: purchases.length + 1,
    wallet,
    token,
    amount: Number(amount),
    total: String(amount),
    fee: String(amount * currentTier.price_usdc),
    tier: currentTier.tier,
    transaction_signature,
    timestamp: new Date().toISOString(),
    claimed: false,
  };
  purchases.push(purchase);
  await saveData(); // αποθήκευση στο δίσκο
  console.log(`🛒 Purchase: ${amount} tokens by ${wallet.slice(0, 6)}...`);
  res.json(purchase);
});

// Έλεγχος αν κάποιος μπορεί να κάνει claim
app.get('/can-claim/:wallet', (req, res) => {
  const { wallet } = req.params;
  const userPurchases = purchases.filter(p => p.wallet === wallet);
  const totalTokens = userPurchases.reduce((total, p) => total + p.amount, 0);
  const anyClaimed = userPurchases.some(p => p.claimed);
  res.json({
    canClaim: totalTokens > 0 && !anyClaimed,
    total: totalTokens > 0 ? String(totalTokens) : undefined,
  });
});

// Καταγραφή claim
app.post('/claim', async (req, res) => {
  const { wallet, transaction_signature } = req.body;
  if (!wallet || !transaction_signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const userPurchases = purchases.filter(p => p.wallet === wallet);
  const anyClaimed = userPurchases.some(p => p.claimed);
  if (anyClaimed) {
    return res.status(400).json({ error: 'Tokens already claimed' });
  }
  const totalTokens = userPurchases.reduce((total, p) => total + p.amount, 0);
  if (totalTokens <= 0) {
    return res.status(400).json({ error: 'No tokens to claim' });
  }
  // Μαρκάρουμε τις αγορές ως claimed
  userPurchases.forEach(p => {
    const idx = purchases.findIndex(x => x.id === p.id);
    if (idx !== -1) purchases[idx].claimed = true;
  });
  // Δημιουργούμε την εγγραφή claim
  const claim = {
    id: claims.length + 1,
    wallet,
    total_tokens: totalTokens,
    transaction_signature,
    timestamp: new Date().toISOString(),
  };
  claims.push(claim);
  await saveData(); // αποθήκευση στο δίσκο
  console.log(`🎉 Claimed: ${totalTokens} tokens by ${wallet.slice(0, 6)}...`);
  res.json({ success: true });
});

// Επιστρέφει το snapshot όλων των αγορών
app.get('/snapshot', (req, res) => {
  res.json(purchases);
});

// Εξαγωγή των αγορών σε CSV
app.get('/export', (req, res) => {
  const header = 'id,wallet,token,amount,tier,transaction_signature,timestamp,claimed\n';
  const rows = purchases
    .map(p =>
      `${p.id},${p.wallet},${p.token},${p.amount},${p.tier},${p.transaction_signature},${p.timestamp},${p.claimed}`,
    )
    .join('\n');
  res.setHeader('Content-Disposition', 'attachment; filename=presale_snapshot.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(header + rows);
});

// === Έναρξη server ===
(async () => {
  await initializeData();
  app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
  });
})();
