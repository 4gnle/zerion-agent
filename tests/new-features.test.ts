import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { usdToWei, amountFor } from '../lib/amounts';
import { validateIntent, guardText } from '../lib/intent';
import { normalizeQuote, assertSignable, LIFI_ROUTER } from '../lib/quote';
import { BASE_USDC } from '../lib/config';
import { bridgeResult } from '../lib/bridge-status';
import { restore } from '../lib/recovery';
import { allowsOrigin, handle } from '../lib/http.server';
import { protectPublicApi } from '../lib/public-access.server';
afterEach(() => vi.unstubAllEnvs());
const account = '0x1111111111111111111111111111111111111111';
const hash = `0x${'a'.repeat(64)}`, destinationHash = `0x${'b'.repeat(64)}`;
const intent = { status: 'ready', sellToken: 'ETH', buyToken: 'USDC', chain: 'base', amountType: 'usd', amount: '2', recipient: 'self', reason: 'none' };
it('interprets USD as input value and floors conversion to wei', () => {
  expect(() => guardText('Bridge $2 of ETH to Base then swap into USDC')).not.toThrow();
  expect(validateIntent(intent).amountType).toBe('usd');
  expect(usdToWei('20', '2500')).toBe(8000000000000000n);
  expect(usdToWei('2', '3000')).toBe(666666666666666n);
  expect(() => amountFor(validateIntent(intent), 1000000000000000n)).toThrow('Resolve');
});
it.each(['0', '-1', '1e3', '1,000', '2.001'])('rejects invalid USD %s', amount => expect(() => usdToWei(amount, '2500')).toThrow());
it.each(['0', '-1', 'NaN', 'Infinity'])('rejects unavailable price %s', price => expect(() => usdToWei('2', price)).toThrow());
const raw = () => ({ id: 'base-route', attributes: { liquidity_source: { id: 'lifi', name: 'LI.FI' }, input_amount: { quantity: '0.001' }, output_amount: { quantity: '2.7' }, minimum_output_amount: { quantity: '2.6' }, slippage_percent: 0.5, transaction_swap: { evm: { from: account, to: LIFI_ROUTER, chain_id: '0xa4b1', value: '0x38d7ea4c68000', data: '0xa1f1ce43' } } }, relationships: { input_chain: { data: { id: 'arbitrum' } }, output_chain: { data: { id: 'base' } }, input_fungible: { data: { id: 'eth' } }, output_fungible: { data: { id: 'usdc' } } } });
const normalize = (r: unknown) => normalizeQuote(r, account, 1000000000000000n, { sell: 'eth', buy: 'usdc' }, 'lifi', Date.now(), false, true);
it('accepts only the pinned combined source transaction and Base destination', () => {
  const q = normalize(raw()); expect(q).toMatchObject({ chain: 42161, destination: 8453, executable: true });
  expect(() => assertSignable(q, account, 42161)).not.toThrow();
  expect(() => assertSignable(q, account, 8453)).toThrow();
});
it.each(['source', 'destination', 'token', 'router', 'value', 'precision', 'approval'])('rejects corrupted Base route %s', field => {
  const r = raw();
  if (field === 'source') r.relationships.input_chain.data.id = 'ethereum';
  if (field === 'destination') r.relationships.output_chain.data.id = 'arbitrum';
  if (field === 'token') r.relationships.output_fungible.data.id = 'eth';
  if (field === 'router') r.attributes.transaction_swap.evm.to = account;
  if (field === 'value') r.attributes.transaction_swap.evm.value = '0x1';
  if (field === 'precision') r.attributes.output_amount.quantity = '2.1234567';
  if (field === 'approval') Object.assign(r.attributes, { transaction_approve: {} });
  expect(() => normalize(r)).toThrow();
});
const delivered = () => ({ status: 'DONE', substatus: 'COMPLETED', fromAddress: account, toAddress: account, sending: { txHash: hash, chainId: 42161 }, receiving: { txHash: destinationHash, chainId: 8453, amount: '2700000', token: { address: BASE_USDC, decimals: 6 } } });
it('verifies native Base USDC delivery, not just source success', () => {
  expect(bridgeResult(delivered(), hash, account, '2.6', true).complete).toBe(true);
  expect(bridgeResult({ status: 'PENDING' }, hash, account, '2.6', true).complete).toBe(false);
  expect(bridgeResult({ ...delivered(), substatus: 'PARTIAL' }, hash, account, '2.6', true).complete).toBe(false);
  expect(bridgeResult({ ...delivered(), substatus: 'REFUNDED' }, hash, account, '2.6', true).complete).toBe(false);
  expect(() => bridgeResult(delivered(), hash, account, '3', true)).toThrow();
  const original = delivered(); const wrong = { ...original, receiving: { ...original.receiving, token: { ...original.receiving.token, address: account } } }; expect(() => bridgeResult(wrong, hash, account, '2.6', true)).toThrow();
});
it('restores the Base destination and rejects impossible recovery routes', () => {
  const p = { hash, chain: 42161, destination: 8453, account, sell: '1000000000000000', expected: '2.7', source: 'LI.FI', minimum: '2.6' };
  expect(restore(JSON.stringify(p))?.destination).toBe(8453);
  expect(restore(JSON.stringify({ ...p, chain: 1 }))).toBeNull();
});
const production = () => new Request('https://zerion-agent-eight.vercel.app/api/history', { method: 'POST', headers: { origin: 'https://zerion-agent-eight.vercel.app', host: 'zerion-agent-eight.vercel.app', 'content-type': 'application/json' }, body: '{}' });
it('allows the Vercel production origin but not arbitrary origins or mismatched hosts', () => {
  vi.stubEnv('APP_ORIGIN', ''); vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'zerion-agent-eight.vercel.app');
  const req = production(); expect(allowsOrigin(req)).toBe(true);
  req.headers.set('host', 'other.vercel.app'); expect(allowsOrigin(req)).toBe(false);
  req.headers.set('origin', 'https://other.vercel.app'); expect(allowsOrigin(req)).toBe(false);
});
it('requires explicit hosted API activation before calling a provider', async () => {
  vi.stubEnv('APP_ORIGIN', 'https://zerion-agent-eight.vercel.app'); vi.stubEnv('PUBLIC_API_ENABLED', 'false');
  const fn = vi.fn(); const result = await handle(production(), 'price', z.object({}), fn);
  expect(result.status).toBe(503); expect(fn).not.toHaveBeenCalled();
});
it('supports a kill switch and hosted activation', async () => {
  vi.stubEnv('PUBLIC_API_ENABLED', 'true'); await expect(protectPublicApi(production(), 'price')).resolves.toBeUndefined();
  vi.stubEnv('API_ENABLED', 'false'); await expect(protectPublicApi(production(), 'price')).rejects.toMatchObject({ code: 'PAUSED' });
});
