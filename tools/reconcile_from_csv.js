// Usage: node tools/reconcile_from_csv.js path/to/txs.csv
// CSV: wallet,token,amount,transaction_signature,timestamp
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = process.argv[2];
if (!csvPath) { console.error('Provide CSV path: node tools/reconcile_from_csv.js txs.csv'); process.exit(1); }

const baseDir = path.resolve(__dirname, '..');
const purchasesPath = path.join(baseDir, 'data', 'purchases.json');

const purchases = fs.existsSync(purchasesPath) ? JSON.parse(fs.readFileSync(purchasesPath, 'utf-8')) : [];
const rows = parse(fs.readFileSync(csvPath, 'utf-8'), { columns: true, skip_empty_lines: true });

const existingBySig = new Set(purchases.map(p => p.transaction_signature));
let added = 0, id = purchases.reduce((m, p) => Math.max(m, p.id || 0), 0);

for (const r of rows) {
  const sig = r.transaction_signature?.trim(); if (!sig || existingBySig.has(sig)) continue;
  purchases.push({
    id: ++id, wallet: r.wallet?.trim(), token: (r.token?.trim()?.toUpperCase() === 'USDC') ? 'USDC' : 'SOL',
    amount: parseFloat(r.amount), tier: null, transaction_signature: sig,
    timestamp: r.timestamp || new Date().toISOString(), claimed: false
  });
  existingBySig.add(sig); added++;
}

purchases.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
fs.mkdirSync(path.dirname(purchasesPath), { recursive: true });
fs.writeFileSync(purchasesPath, JSON.stringify(purchases, null, 2));
console.log(`Imported ${added} new purchase records from ${csvPath}`);
