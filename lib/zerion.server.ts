import 'server-only';
import { erc20Abi, formatUnits, zeroAddress } from 'viem';
import { chainSlug, tokenAddress, tokenDecimals, type Route, type ChainId, type Token } from './routes';
import { clientFor } from './rpc';
import { z } from 'zod';
import type { Address } from 'viem';
import { USDC, BASE_USDC } from './config';
import { AppError } from './errors';
import { eth } from './amounts';
import { normalizeQuote } from './quote';
let lastRequest = 0;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function zerionGet(path: string, params: URLSearchParams): Promise<unknown> {
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
  const usdc = asset.parse(await zerionGet('/v1/fungibles/by-implementation', new URLSearchParams({ implementation: `arbitrum:${USDC}` })));
  const native = asset.parse(await zerionGet('/v1/fungibles/by-implementation', new URLSearchParams({ implementation: 'arbitrum' })));
  if (!usdc.data.attributes.implementations?.some(i => i.chain_id === 'arbitrum' && i.address?.toLowerCase() === USDC.toLowerCase() && i.decimals === 6) || native.data.attributes.symbol !== 'ETH') throw new AppError('METADATA', 'The provider asset metadata did not match this pair.', 502);
  return assets = { sell: native.data.id, buy: usdc.data.id };
}
export async function getQuote(account: Address, amount: bigint) {
  const ids = await resolveAssets();
  const response = z.object({ data: z.array(z.unknown()) }).parse(await zerionGet('/v1/swap/quotes/', new URLSearchParams({ currency: 'usd', from: account, to: account, 'input[chain_id]': 'arbitrum', 'input[fungible_id]': ids.sell, 'input[amount]': eth(amount), 'output[chain_id]': 'arbitrum', 'output[fungible_id]': ids.buy, slippage_percent: '0.5' })));
  const source = process.env.ZERION_ATOMIC_SOURCE_ID || '';
  if (source && source !== 'kyber') throw new AppError('ROUTE', 'The configured route is unsupported by this prototype.', 503);
  const candidate = response.data.find(q => z.object({ attributes: z.object({ liquidity_source: z.object({ id: z.literal('kyber') }) }) }).safeParse(q).success);
  if (!candidate) throw new AppError('ROUTE', 'The selected KyberSwap route is unavailable. Try again later.', 503);
  return normalizeQuote(candidate, account, amount, ids, source);
}

export async function getBridgeQuote(account: Address, amount: bigint) {
  const response = z.object({ data: z.array(z.unknown()) }).parse(await zerionGet('/v1/swap/quotes/', new URLSearchParams({ currency: 'usd', from: account, to: account, 'input[chain_id]': 'ethereum', 'input[fungible_id]': 'eth', 'input[amount]': eth(amount), 'output[chain_id]': 'arbitrum', 'output[fungible_id]': 'eth', slippage_percent: '0.5' })));
  const candidate = response.data.find(q => z.object({ attributes: z.object({ liquidity_source: z.object({ id: z.literal('lifi') }) }) }).safeParse(q).success);
  if (!candidate) throw new AppError('ROUTE', 'The Ethereum → Arbitrum bridge route is unavailable.', 503);
  return normalizeQuote(candidate, account, amount, { sell: 'eth', buy: 'eth' }, process.env.ZERION_BRIDGE_SOURCE_ID || '', Date.now(), true);
}

let baseAsset: string | undefined;
export async function getBaseQuote(account: Address, amount: bigint) {
  const ids = await resolveAssets();
  if (!baseAsset) {
    const result = z.object({ data: z.object({ id: z.string(), attributes: z.object({ implementations: z.array(z.object({ chain_id: z.string(), address: z.string().nullish(), decimals: z.number() })) }) }) }).parse(await zerionGet('/v1/fungibles/by-implementation', new URLSearchParams({ implementation: `base:${BASE_USDC}` })));
    if (!result.data.attributes.implementations.some(i => i.chain_id === 'base' && i.address?.toLowerCase() === BASE_USDC.toLowerCase() && i.decimals === 6)) throw new AppError('METADATA', 'Base USDC metadata did not match.', 502);
    baseAsset = result.data.id;
  }
  const response = z.object({ data: z.array(z.unknown()) }).parse(await zerionGet('/v1/swap/quotes/', new URLSearchParams({ currency: 'usd', from: account, to: account, 'input[chain_id]': 'arbitrum', 'input[fungible_id]': ids.sell, 'input[amount]': eth(amount), 'output[chain_id]': 'base', 'output[fungible_id]': baseAsset, slippage_percent: '0.5' })));
  const candidate = response.data.find(q => z.object({ attributes: z.object({ liquidity_source: z.object({ id: z.literal('lifi') }) }) }).safeParse(q).success);
  if (!candidate) throw new AppError('ROUTE', 'No combined Arbitrum → Base USDC route is available for this amount.');
  return normalizeQuote(candidate, account, amount, { sell: ids.sell, buy: baseAsset }, process.env.ZERION_BRIDGE_SOURCE_ID || '', Date.now(), false, true);
}
export async function ethPrice() {
  const schema = z.object({ data: z.object({ attributes: z.object({ market_data: z.object({ price: z.number().positive().finite() }) }) }) });
  const data = schema.parse(await zerionGet('/v1/fungibles/eth', new URLSearchParams({ currency: 'usd' })));
  return { price: data.data.attributes.market_data.price.toFixed(18), fetchedAt: Date.now() };
}

const resolvedAssets = new Map<string, string>();
export async function routeAsset(chain: ChainId, token: Token) {
  const key = `${chain}:${token}`;
  const cached = resolvedAssets.get(key); if (cached) return cached;
  const slug = chainSlug(chain), address = tokenAddress(chain, token);
  const result = z.object({ data: z.object({ id: z.string(), attributes: z.object({ symbol: z.string(), implementations: z.array(z.object({ chain_id: z.string(), address: z.string().nullish(), decimals: z.number() })) }) }) }).parse(await zerionGet('/v1/fungibles/by-implementation', new URLSearchParams({ implementation: token === 'ETH' ? slug : `${slug}:${address}` })));
  if (result.data.attributes.symbol !== token || !result.data.attributes.implementations.some(i => i.chain_id === slug && i.decimals === tokenDecimals(token) && (token === 'ETH' ? !i.address || i.address === zeroAddress : i.address?.toLowerCase() === address.toLowerCase()))) throw new AppError('METADATA', 'The token metadata did not match the requested network.', 502);
  resolvedAssets.set(key, result.data.id); return result.data.id;
}
export async function getRouteQuote(account: Address, amount: bigint, route: Route) {
  const sell = await routeAsset(route.from, route.sellToken), buy = await routeAsset(route.to, route.buyToken);
  const cross = route.from !== route.to, source = cross ? 'lifi' : 'kyber';
  const response = z.object({ data: z.array(z.unknown()) }).parse(await zerionGet('/v1/swap/quotes/', new URLSearchParams({ currency: 'usd', from: account, to: account, 'input[chain_id]': chainSlug(route.from), 'input[fungible_id]': sell, 'input[amount]': formatUnits(amount, tokenDecimals(route.sellToken)), 'output[chain_id]': chainSlug(route.to), 'output[fungible_id]': buy, slippage_percent: '0.5' })));
  const candidate = response.data.find(q => z.object({ attributes: z.object({ liquidity_source: z.object({ id: z.literal(source) }) }) }).safeParse(q).success);
  if (!candidate) throw new AppError('ROUTE', 'No supported route is available for this pair and amount. Try a different amount.');
  const quote = normalizeQuote(candidate, account, amount, { sell, buy }, (cross ? process.env.ZERION_BRIDGE_SOURCE_ID : process.env.ZERION_ATOMIC_SOURCE_ID) || '', Date.now(), false, false, route);
  if (route.sellToken === 'USDC' && quote.swap) {
    const allowance = await clientFor(route.from).readContract({ address: tokenAddress(route.from, 'USDC'), abi: erc20Abi, functionName: 'allowance', args: [account, quote.swap.to] });
    quote.approvalRequired = allowance < amount;
  }
  return quote;
}
export async function tokenPrice(token: Token) {
  if (token === 'ETH') return ethPrice();
  const id = await routeAsset(42161, 'USDC');
  const data = z.object({ data: z.object({ attributes: z.object({ market_data: z.object({ price: z.number().positive().finite() }) }) }) }).parse(await zerionGet(`/v1/fungibles/${encodeURIComponent(id)}`, new URLSearchParams({ currency: 'usd' })));
  return { price: data.data.attributes.market_data.price.toFixed(18), fetchedAt: Date.now() };
}
