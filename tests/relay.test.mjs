import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/[[path]].js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const secret = 'a'.repeat(64);
const request = (path, init) => new Request(`https://relay.example/${path}`, init);

test('fails closed for missing secret, wrong secret, malformed paths and methods', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('unexpected'); };
  assert.equal((await onRequest({ request: request('x'), env: {} })).status, 503);
  assert.equal((await onRequest({ request: request('wrong/bot1:abc/getMe'), env: { PROXY_SECRET: secret } })).status, 404);
  assert.equal((await onRequest({ request: request(`${secret}/https://evil.test/`), env: { PROXY_SECRET: secret } })).status, 404);
  assert.equal((await onRequest({ request: request(`${secret}/bot1:abc/getMe`, { method: 'DELETE' }), env: { PROXY_SECRET: secret } })).status, 405);
  assert.equal(called, false);
});

test('forwards polling and file downloads only to Telegram and streams the response', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('ok', { headers: { 'content-type': 'text/plain' } }); };
  const polling = await onRequest({ request: request(`${secret}/bot123:abc_DEF/getUpdates?timeout=30`), env: { PROXY_SECRET: secret } });
  assert.equal(calls[0].url, 'https://api.telegram.org/bot123:abc_DEF/getUpdates?timeout=30');
  assert.equal(await polling.text(), 'ok');
  assert.equal(polling.headers.get('cache-control'), 'no-store');
  await onRequest({ request: request(`${secret}/file/bot123:abc_DEF/documents/file.pdf`), env: { PROXY_SECRET: secret } });
  assert.equal(calls[1].url, 'https://api.telegram.org/file/bot123:abc_DEF/documents/file.pdf');
});

test('forwards POST bodies and hides upstream errors', async () => {
  globalThis.fetch = async (url, init) => { assert.equal(url, 'https://api.telegram.org/bot123:abc/sendMessage'); assert.equal(await new Response(init.body).text(), '{"text":"hello"}'); assert.equal(init.headers.get('content-type'), 'application/json'); return Response.json({ ok: true }); };
  const result = await onRequest({ request: request(`${secret}/bot123:abc/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"text":"hello"}' }), env: { PROXY_SECRET: secret } });
  assert.equal(result.status, 200);
  globalThis.fetch = async () => { throw new Error('bot123:abc secret error'); };
  const failure = await onRequest({ request: request(`${secret}/bot123:abc/getMe`), env: { PROXY_SECRET: secret } });
  assert.equal(failure.status, 502);
  assert.equal((await failure.text()).includes('bot123:abc'), false);
});
