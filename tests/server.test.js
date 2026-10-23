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
    const productsResponse = await fetch('http://127.0.0.1:' + port + '/api/products');
    assert.equal(productsResponse.status, 200);
    assert.deepEqual((await productsResponse.json()).products, []);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 1500))]);
    await rm(dir, { recursive: true, force: true });
  }
});
