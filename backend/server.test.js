import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'test-data');
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = 'test';
process.env.ADMIN_SECRET = 'test';

await fs.rm(dataDir, { recursive: true, force: true });

const { app, initializeData } = await import('./server.js');
await initializeData();
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test('malformed JSON in /buy returns 400', async () => {
  const res = await fetch(base + '/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'not-json'
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Invalid JSON');
});

test('negative amount rejected', async () => {
  const res = await fetch(base + '/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: 'testwallet',
      amount: -5,
      token: 'SOL',
      transaction_signature: 'sig-negative'
    })
  });
  assert.equal(res.status, 400);
});

test('/debug/migration-status requires admin secret', async () => {
  const unauth = await fetch(base + '/debug/migration-status');
  assert.equal(unauth.status, 401);

  const auth = await fetch(base + '/debug/migration-status', {
    headers: { 'x-admin-secret': 'test' }
  });
  assert.equal(auth.status, 200);
  const body = await auth.json();
  assert.ok('done' in body);
});

test('cleanup', () => {
  server.close();
});
