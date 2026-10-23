import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('health and public product endpoints start without secrets', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'padnakasht-store-'));
  const port = 31000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), DATABASE_PATH: path.join(dir, 'test.sqlite'), BOT_TOKEN: '', ADMIN_TELEGRAM_IDS: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', x => { logs += x.toString(); });
  child.stderr.on('data', x => { logs += x.toString(); });
  try {
    let response;
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error('server exited early: ' + logs);
      try { response = await fetch('http://127.0.0.1:' + port + '/api/health'); if (response.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(response?.ok, 'server should start and return health');
    const health = await response.json();
    assert.equal(health.ok, true);
    assert.equal(health.telegramAuthConfigured, false);
    const configResponse = await fetch('http://127.0.0.1:' + port + '/api/config');
    assert.equal(configResponse.status, 200);
    const config = await configResponse.json();
    assert.equal(config.delivery.feeToman, 0);
    assert.equal(config.delivery.label, 'ارسال رایگان');
    assert.equal(config.delivery.isfahan, true);
    assert.equal(config.delivery.post, true);
    const productsResponse = await fetch('http://127.0.0.1:' + port + '/api/products');
    assert.equal(productsResponse.status, 200);
    assert.deepEqual((await productsResponse.json()).products, []);
    assert.equal(JSON.stringify(config).includes('CARD_NUMBER'), false, 'public config must never expose card details');
    assert.equal(JSON.stringify(await productsResponse.json()).includes('CARD_NUMBER'), false, 'public products must never expose card details');
    const unauthorizedOrder = await fetch('http://127.0.0.1:' + port + '/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '09123456789', city: 'اصفهان', address: 'نشانی آزمایشی معتبر', deliveryMethod: 'isfahan', items: [{ productId: 'walnut', quantity: 1 }] })
    });
    assert.equal(unauthorizedOrder.status, 401, 'orders must reject requests without signed Telegram initData');
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 1500))]);
    await rm(dir, { recursive: true, force: true });
  }
});
