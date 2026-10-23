// End-to-end API flow. Needs Postgres: TEST_DATABASE_URL (the tables in it are emptied).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/miniledger_test';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
// Loaded after DATABASE_URL is set (static imports would be hoisted above it).
const { createApp } = require('../src/app') as typeof import('../src/app');
const { migrate, pool } = require('../src/db') as typeof import('../src/db');

let server: Server;
let base = '';
let token = '';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function call(method: string, path: string, body?: unknown, auth = token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(auth && { authorization: `Bearer ${auth}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

test.before(async () => {
  await migrate();
  await pool.query('TRUNCATE loans, sessions, users RESTART IDENTITY CASCADE');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.after(async () => {
  server.close();
  await pool.end();
});

test('login with phone + mock OTP printed to the server log', async () => {
  assert.equal((await call('POST', '/auth/request-otp', { phone: 'abc' })).status, 400);

  const logged: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => logged.push(args.join(' '));
  const sent = await call('POST', '/auth/request-otp', { phone: '+919876543210' });
  console.log = original;
  assert.equal(sent.status, 200);
  const otp = logged.join('\n').match(/OTP for \+919876543210 is (\d{6})/)?.[1];
  assert.ok(otp, 'OTP was printed');

  const wrong = otp === '000000' ? '111111' : '000000';
  assert.equal((await call('POST', '/auth/verify-otp', { phone: '+919876543210', otp: wrong })).status, 401);
  const ok = await call('POST', '/auth/verify-otp', { phone: '+91 98765 43210', otp });
  assert.equal(ok.status, 200);
  token = ok.body.token;
  assert.match(token, /^[0-9a-f]{64}$/);
});

test('loan routes require a session', async () => {
  assert.equal((await call('GET', '/loans', undefined, '')).status, 401);
  assert.equal((await call('GET', '/summary', undefined, 'nope')).status, 401);
});

test('add entries, mark one repaid, and get the summary', async () => {
  const overdue = await call('POST', '/loans', { friendName: 'Rohan', amount: 500, dueDate: day(-3) });
  assert.equal(overdue.status, 201);
  assert.equal(overdue.body.overdue, true);

  const future = await call('POST', '/loans', { friendName: 'Meera', amount: 1200.5, dueDate: day(10) });
  assert.equal(future.body.overdue, false);

  const late = await call('POST', '/loans', { friendName: 'Kabir', amount: 300, dueDate: day(-1) });
  const repaid = await call('POST', `/loans/${late.body.id}/repay`);
  assert.equal(repaid.status, 200);
  assert.ok(repaid.body.repaidAt);
  assert.equal(repaid.body.overdue, false);

  const bad = await call('POST', '/loans', { friendName: '', amount: -1, dueDate: 'tomorrow' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /friendName/);

  assert.equal((await call('POST', '/loans/9999/repay')).status, 404);

  const list = await call('GET', '/loans');
  assert.deepEqual(list.body.map((l: { friendName: string }) => l.friendName), ['Rohan', 'Meera', 'Kabir']);

  const summary = await call('GET', '/summary');
  assert.deepEqual(summary.body, { totalLent: 2000.5, totalRepaid: 300, overdueAmount: 500 });
});

test('a receipt photo can be attached and fetched back', async () => {
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const created = await call('POST', '/loans', {
    friendName: 'Isha', amount: 80, dueDate: day(5), receipt: { base64: png.toString('base64'), mimeType: 'image/png' },
  });
  assert.equal(created.body.hasReceipt, true);
  const receipt = await call('GET', `/loans/${created.body.id}/receipt`);
  assert.equal(receipt.status, 200);
  assert.deepEqual(receipt.body, png);
});
