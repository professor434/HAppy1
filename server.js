import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const SPL_MINT_ADDRESS = "7TaNrHwaG4ii4F7R6vsfyaZxxTPQ5TKNhUWzmjs8EJRp"; 
const FEE_WALLET = "7ZZLAAdhz1GqL7Ug3CF4pGbUZ3tMLamQ2WrNNYAXkbdw";

// Initialize data store - in a real app, this would be a database
let purchases = [];
let claims = [];

// Parse JSON bodies
app.use(express.json());

// Enable CORS for frontend requests
app.use(cors({
  origin: 'http://localhost:5173', // Vite development server
  credentials: true
}));

// Load presale tiers from JSON file
const loadTiers = async () => {
  try {
    const tiersData = await fs.readFile(path.join(__dirname, 'presale_tiers.json'), 'utf8');
    return JSON.parse(tiersData);
  } catch (error) {
    console.error('Error loading presale tiers:', error);
    return [];
  }
};

// Current tier and presale status
let currentTierIndex = 0;
let presaleTiers = [];

// Initialize data
const initializeData = async () => {
  presaleTiers = await loadTiers();
  console.log(`Loaded ${presaleTiers.length} presale tiers`);
};

// Calculate total tokens sold
const calculateTotalRaised = () => {
  return purchases.reduce((total, purchase) => total + purchase.amount, 0);
};

// Calculate current tier based on tokens sold
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
  
  // If we've exceeded all tiers, stay at the last one
  currentTierIndex = presaleTiers.length - 1;
};

// API Routes
app.get('/tiers', async (req, res) => {
  if (presaleTiers.length === 0) {
    await initializeData();
  }
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
  
  // Validate required fields
  if (!wallet || !amount || !token || !transaction_signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Update current tier
  updateCurrentTier();
  const currentTier = presaleTiers[currentTierIndex];
  
  // Record purchase
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
  console.log(`Recorded purchase: ${amount} tokens for wallet ${wallet.slice(0, 6)}...`);
  
  res.json(purchase);
});

app.get('/can-claim/:wallet', (req, res) => {
  const { wallet } = req.params;
  
  // Find all purchases for this wallet
  const userPurchases = purchases.filter(p => p.wallet === wallet);
  
  // Calculate total tokens purchased
  const totalTokens = userPurchases.reduce((total, p) => total + p.amount, 0);
  
  // Check if any purchases are already claimed
  const anyClaimed = userPurchases.some(p => p.claimed);
  
  res.json({
    canClaim: totalTokens > 0 && !anyClaimed,
    total: totalTokens > 0 ? String(totalTokens) : undefined
  });
});

app.post('/claim', (req, res) => {
  const { wallet, transaction_signature } = req.body;
  
  // Validate required fields
  if (!wallet || !transaction_signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Find all purchases for this wallet
  const userPurchases = purchases.filter(p => p.wallet === wallet);
  
  // Check if already claimed
  const anyClaimed = userPurchases.some(p => p.claimed);
  if (anyClaimed) {
    return res.status(400).json({ error: 'Tokens already claimed' });
  }
  
  // Calculate total tokens purchased
  const totalTokens = userPurchases.reduce((total, p) => total + p.amount, 0);
  
  if (totalTokens <= 0) {
    return res.status(400).json({ error: 'No tokens to claim' });
  }
  
  // Mark all purchases as claimed
  userPurchases.forEach(p => {
    const index = purchases.findIndex(purchase => purchase.id === p.id);
    if (index !== -1) {
      purchases[index].claimed = true;
    }
  });
  
  // Record claim
  const claim = {
    id: claims.length + 1,
    wallet,
    total_tokens: totalTokens,
    transaction_signature,
    timestamp: new Date().toISOString()
  };
  
  claims.push(claim);
  console.log(`Recorded claim: ${totalTokens} tokens for wallet ${wallet.slice(0, 6)}...`);
  
  res.json({ success: true });
});

app.get('/snapshot', (req, res) => {
  res.json(purchases);
});

app.get('/export', (req, res) => {
  // Generate CSV data
  const header = 'id,wallet,token,amount,tier,transaction_signature,timestamp,claimed\n';
  const rows = purchases.map(p => 
    `${p.id},${p.wallet},${p.token},${p.amount},${p.tier},${p.transaction_signature},${p.timestamp},${p.claimed}`
  ).join('\n');
  
  const csv = header + rows;
  
  // Set headers for file download
  res.setHeader('Content-Disposition', 'attachment; filename=presale_snapshot.csv');
  res.setHeader('Content-Type', 'text/csv');
  
  res.send(csv);
});

// Initialize and start the server
(async () => {
  await initializeData();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`CORS enabled for http://localhost:5173`);
  });
})();