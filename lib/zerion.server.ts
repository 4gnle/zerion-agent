import 'server-only';
import { z } from 'zod';
import type { Address } from 'viem';
import { USDC } from './config';
import { AppError } from './errors';
import { usdc } from './amounts';
import { normalizeQuote } from './quote';
let lastRequest = 0;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
async function get(path: string, params: URLSearchParams): Promise<unknown> {
  const key = process.env.ZERION_API_KEY;
  if (!key) throw new AppError('CONFIG', 'Zerion API access is not configured.', 503);
  const url = new URL(path, 'https://api.zerion.io'); url.search = params.toString();
  for (let attempt = 0; attempt < 2; attempt++) {
    await delay(Math.max(0, lastRequest + 1500 - Date.now())); lastRequest = Date.now();
    let response: Response;
    try { response = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store' }); }
    catch { throw new AppError('PROVIDER_NETWORK', 'Couldn’t reach Zerion. Try again.', 503); }
    if (response.status === 429 && attempt === 0) {
      const value = response.headers.get('retry-after');
      const wait = value && /^\d+$/.test(value) ? Number(value) * 1000 : value ? Date.parse(value) - Date.now() : 2000;
      if (Number.isFinite(wait) && wait >= 0 && wait <= 10000) { await delay(wait); continue; }
    }
    if (!response.ok) throw new AppError('PROVIDER_ACCESS', response.status === 429 ? 'Zerion is rate limiting requests. Wait a moment, then refresh.' : 'Couldn’t get a live quote. Check Zerion access and try again.', 503);
    try { return await response.json(); } catch { throw new AppError('PROVIDER_SCHEMA', 'Zerion returned an unreadable response.', 502); }
  }
  throw new AppError('PROVIDER_ACCESS', 'Zerion is unavailable.', 503);
}
let assets: { sell: string; buy: string } | null = null;
async function resolveAssets() {
  if (assets) return assets;
  const asset = z.object({ data: z.object({ id: z.string(), attributes: z.object({ symbol: z.string(), implementations: z.array(z.object({ chain_id: z.string(), address: z.string().nullish(), decimals: z.number() })).optional() }) }) });
  const sell = asset.parse(await get('/v1/fungibles/by-implementation', new URLSearchParams({ implementation: `base:${USDC}` })));
  const buy = asset.parse(await get('/v1/fungibles/by-implementation', new URLSearchParams({ implementation: 'base' })));
  if (!sell.data.attributes.implementations?.some(i => i.chain_id === 'base' && i.address?.toLowerCase() === USDC.toLowerCase() && i.decimals === 6) || buy.data.attributes.symbol !== 'ETH') throw new AppError('METADATA', 'The provider asset metadata did not match this pair.', 502);
  return assets = { sell: sell.data.id, buy: buy.data.id };
}
export async function getQuote(account: Address, amount: bigint) {
  const ids = await resolveAssets();
  const response = z.object({ data: z.array(z.unknown()) }).parse(await get('/v1/swap/quotes/', new URLSearchParams({ currency: 'usd', from: account, to: account, 'input[chain_id]': 'base', 'input[fungible_id]': ids.sell, 'input[amount]': usdc(amount), 'output[chain_id]': 'base', 'output[fungible_id]': ids.buy, slippage_percent: '0.5' })));
  const source = process.env.ZERION_ATOMIC_SOURCE_ID || '';
  if (source && source !== 'kyber') throw new AppError('ROUTE', 'The configured route is unsupported by this prototype.', 503);
  const candidate = response.data.find(q => z.object({ attributes: z.object({ liquidity_source: z.object({ id: z.literal('kyber') }) }) }).safeParse(q).success);
  if (!candidate) throw new AppError('ROUTE', 'The selected KyberSwap route is unavailable. Try again later.', 503);
  return normalizeQuote(candidate, account, amount, ids, source);
}
