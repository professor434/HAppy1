import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const SPL_MINT_ADDRESS = new PublicKey('GgzjNE5YJ8FQ4r1Ts4vfUUq87ppv5qEZQ9uumVM7txGs'); // μόνο για τον SPL Token!
const TREASURY_WALLET = new PublicKey('6fcXfgceVof1Lv6WzNZWSD4jQc9up5ctE3817RE2a9gD'); // τα χρήματα πάνε εδώ
const FEE_WALLET = new PublicKey('J2Vz7te8H8gfUSV6epJtLAJsyAjmRpee5cjjDVuR8tWn');


// CORS for production + localhost
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://happypennisofficialpresale.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// In-memory store
let purchases = [];
let claims = [];

const loadTiers = async () => {
  try {
    const tiersData = await fs.readFile(path.join(__dirname, 'presale_tiers.json'), 'utf8');
    return JSON.parse(tiersData);
  } catch (error) {
    console.error('❌ Error loading presale tiers:', error);
    return [];
  }
};

let currentTierIndex = 0;
let presaleTiers = [];

const initializeData = async () => {
  presaleTiers = await loadTiers();
  console.log(`✅ Loaded ${presaleTiers.length} presale tiers`);
};

const calculateTotalRaised = () => {
  return purchases.reduce((total, purchase) => total + purchase.amount, 0);
};

const updateCurrentTier = () => {
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
};

// === ROUTES ===

app.get('/tiers', async (req, res) => {
  if (presaleTiers.length === 0) await initializeData();
  updateCurrentTier();
  res.json(presaleTiers[currentTierIndex]);
});

app.get('/status', (req, res) => {
  updateCurrentTier();
  res.json({
    raised: calculateTotalRaised(),
    currentTier: presaleTiers[currentTierIndex],
    totalPurchases: purchases.length,
    totalClaims: claims.length,
    spl_address: SPL_MINT_ADDRESS,
    fee_wallet: FEE_WALLET
  });
});

app.post('/buy', (req, res) => {
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
    claimed: false
  };

  purchases.push(purchase);
  console.log(`🛒 Purchase: ${amount} tokens by ${wallet.slice(0, 6)}...`);
  res.json(purchase);
});

app.get('/can-claim/:wallet', (req, res) => {
  const { wallet } = req.params;
  const userPurchases = purchases.filter(p => p.wallet === wallet);
  const totalTokens = userPurchases.reduce((total, p) => total + p.amount, 0);
  const anyClaimed = userPurchases.some(p => p.claimed);

  res.json({
    canClaim: totalTokens > 0 && !anyClaimed,
    total: totalTokens > 0 ? String(totalTokens) : undefined
  });
});

app.post('/claim', (req, res) => {
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

  userPurchases.forEach(p => {
    const index = purchases.findIndex(purchase => purchase.id === p.id);
    if (index !== -1) purchases[index].claimed = true;
  });

  const claim = {
    id: claims.length + 1,
    wallet,
    total_tokens: totalTokens,
    transaction_signature,
    timestamp: new Date().toISOString()
  };

  claims.push(claim);
  console.log(`🎉 Claimed: ${totalTokens} tokens by ${wallet.slice(0, 6)}...`);
  res.json({ success: true });
});

app.get('/snapshot', (req, res) => {
  res.json(purchases);
});

app.get('/export', (req, res) => {
  const header = 'id,wallet,token,amount,tier,transaction_signature,timestamp,claimed\n';
  const rows = purchases.map(p =>
    `${p.id},${p.wallet},${p.token},${p.amount},${p.tier},${p.transaction_signature},${p.timestamp},${p.claimed}`
  ).join('\n');

  res.setHeader('Content-Disposition', 'attachment; filename=presale_snapshot.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(header + rows);
});

// === Start server ===
(async () => {
  await initializeData();
  app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
  });
})();
