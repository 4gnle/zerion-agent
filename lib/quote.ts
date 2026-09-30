import { z } from 'zod';
import { isAddress, parseUnits, zeroAddress, type Address, type Hex } from 'viem';
import { arbitrum, CAP, TTL } from './config';
import { exactAmount } from './amounts';
import { AppError } from './errors';
// Official KyberSwap MetaAggregationRouterV2 deployment; checked against a real Zerion quote.
export const LIFI_ROUTER: Address = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
export const KYBER_ROUTER: Address = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5';
const address = z.string().refine(v => isAddress(v, { strict: false }) && v.toLowerCase() !== zeroAddress).transform(v => v as Address);
const hex = z.string().regex(/^0x[0-9a-fA-F]+$/);
const dataHex = z.string().regex(/^0x(?:[0-9a-fA-F]{2}){4,}$/).transform(v => v as Hex);
const wireTx = z.object({ from: address, to: address, chain_id: hex, value: hex, data: dataHex,
  type: z.enum(['0x0', '0x1', '0x2']).optional(), nonce: hex.optional(), gas: hex.optional(),
  gas_price: hex.optional(), max_fee: hex.optional(), max_priority_fee: hex.optional(),
}).strict();
const quantity = z.object({ quantity: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/) });
const feeSchema = z.object({ amount: quantity.extend({ usd_value: z.number().nonnegative().optional() }), included_in_rate: z.boolean().optional(), percentage: z.number().nonnegative().optional(), fungible: z.object({ id: z.string() }).optional() });
const relation = z.object({ data: z.object({ id: z.string() }) });
const wireQuote = z.object({ id: z.string(), attributes: z.object({
  liquidity_source: z.object({ id: z.string(), name: z.string() }), input_amount: quantity, output_amount: quantity,
  minimum_output_amount: quantity, slippage_percent: z.number(), protocol_fee: feeSchema.nullish(), network_fee: feeSchema.nullish(),
  bridge_fee: feeSchema.nullish(), estimated_time_seconds: z.number().nonnegative().optional(), error: z.object({ code: z.string() }).nullish(),
  transaction_swap: z.object({ evm: wireTx }).strict().nullish(), transaction_approve: z.unknown().optional(),
}).passthrough(), relationships: z.object({ input_chain: relation, output_chain: relation, input_fungible: relation, output_fungible: relation }) });
export type Transaction = { to: Address; data: Hex; value: string };
export type Fee = { label: string; inclusion: string };
export type Quote = {
  mode: 'live' | 'simulation'; requestId: string; providerId: string; account: Address; chain: 1 | 42161; destination?: 8453;
  sell: string; expected: string; minimum: string; sourceId: string; sourceName: string; fetchedAt: number; validUntil: number;
  networkFee: Fee; providerFee: Fee; bridgeFee?: Fee; estimatedSeconds?: number; swap: Transaction | null; executable: boolean; blockedReason: string | null;
};
function fail(): never { throw new AppError('QUOTE_INVALID', 'The quote did not match this action. Wallet actions are disabled.', 502); }
function fee(raw: z.infer<typeof feeSchema> | null | undefined): Fee {
  if (!raw) return { label: 'Unavailable', inclusion: 'Final fee shown in your wallet.' };
  const label = raw.amount.quantity === '0' ? '$0.00' : raw.amount.usd_value !== undefined ? `$${raw.amount.usd_value.toFixed(4)}` : raw.percentage !== undefined ? `${raw.percentage}%` : raw.fungible?.id === 'eth' ? `${raw.amount.quantity} ETH` : 'Unavailable';
  return { label, inclusion: raw.included_in_rate === true ? 'Included in quoted rate.' : raw.included_in_rate === false ? 'Not included in quoted rate.' : 'Fee inclusion unavailable.' };
}
export function normalizeQuote(raw: unknown, account: Address, amount: bigint, assets: { sell: string; buy: string }, pinnedSource: string, now = Date.now(), bridge = false, baseRoute = false): Quote {
  if (bridge && baseRoute) fail();
  const result = wireQuote.safeParse(raw); if (!result.success) fail();
  const { id, attributes: a, relationships: r } = result.data;
  const cross = bridge || baseRoute;
  const source = cross ? 'lifi' : 'kyber', sourceChain = bridge ? 'ethereum' : 'arbitrum', chain = bridge ? 1 : 42161, router = cross ? LIFI_ROUTER : KYBER_ROUTER;
  if (a.liquidity_source.id !== source || (!cross && a.bridge_fee != null) || a.transaction_approve != null || r.input_chain.data.id !== sourceChain || r.output_chain.data.id !== (baseRoute ? 'base' : 'arbitrum') || r.input_fungible.data.id !== assets.sell || r.output_fungible.data.id !== assets.buy || a.slippage_percent !== 0.5 || exactAmount(a.input_amount.quantity) !== amount || amount > CAP) fail();
  if (Object.keys(a).some(k => /permit|signature|typed_data|batch|paymaster/i.test(k) || (k.startsWith('transaction_') && !['transaction_swap', 'transaction_approve'].includes(k)))) fail();
  const usdcDecimal = /^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/;
  if (!bridge && (!usdcDecimal.test(a.output_amount.quantity) || !usdcDecimal.test(a.minimum_output_amount.quantity))) fail();
  const expected = parseUnits(a.output_amount.quantity, bridge ? 18 : 6), minimum = parseUnits(a.minimum_output_amount.quantity, bridge ? 18 : 6);
  if (expected <= 0n || minimum <= 0n || minimum > expected) fail();
  const tx = a.transaction_swap?.evm;
  if (tx && (tx.from.toLowerCase() !== account.toLowerCase() || tx.to.toLowerCase() !== router.toLowerCase() || BigInt(tx.chain_id) !== BigInt(chain) || BigInt(tx.value) !== amount || (tx.gas_price && (tx.max_fee || tx.max_priority_fee)))) fail();
  const blockedReason = a.error ? a.error.code === 'not_enough_input_asset_balance' ? `Not enough ETH on ${bridge ? 'Ethereum' : 'Arbitrum'} for this action.` : 'The provider could not prepare an executable transaction.' : !tx ? 'This quote has no executable transaction.' : pinnedSource !== source ? 'Live execution awaits verification and pinning of this route.' : null;
  return { mode: 'live', requestId: crypto.randomUUID(), providerId: id, account, chain, ...(baseRoute ? { destination: 8453 as const } : {}), sell: amount.toString(), expected: a.output_amount.quantity, minimum: a.minimum_output_amount.quantity, sourceId: a.liquidity_source.id, sourceName: a.liquidity_source.name, fetchedAt: now, validUntil: now + TTL, networkFee: fee(a.network_fee), providerFee: fee(a.protocol_fee), ...(cross ? { bridgeFee: fee(a.bridge_fee), estimatedSeconds: a.estimated_time_seconds } : {}), swap: tx ? { to: tx.to, value: amount.toString(), data: tx.data } : null, executable: !blockedReason, blockedReason };
}
export function assertSignable(q: Quote, account: Address, chainId: number, now = Date.now()) {
  if (q.destination !== undefined && (q.destination !== 8453 || q.chain !== 42161)) throw new AppError('DISABLED', 'Unsupported destination.');
  if (q.mode !== 'live' || !q.executable || !q.swap || !([1, arbitrum.id].includes(q.chain)) || q.sourceId !== (q.chain === 1 || q.destination === 8453 ? 'lifi' : 'kyber') || q.swap.to.toLowerCase() !== (q.chain === 1 || q.destination === 8453 ? LIFI_ROUTER : KYBER_ROUTER).toLowerCase() || BigInt(q.swap.value) !== BigInt(q.sell) || BigInt(q.sell) <= 0n || BigInt(q.sell) > CAP) throw new AppError('DISABLED', 'This quote cannot request a wallet signature.');
  if (q.account.toLowerCase() !== account.toLowerCase() || chainId !== q.chain) throw new AppError('WALLET_CHANGED', 'Your account or network changed. Review a new quote.');
  if (now >= q.validUntil) throw new AppError('EXPIRED', 'Refresh this quote before continuing.');
}
