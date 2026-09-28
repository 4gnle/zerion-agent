import { z } from 'zod';
import { decodeFunctionData, encodeFunctionData, erc20Abi, isAddress, parseUnits, zeroAddress, type Address, type Hex } from 'viem';
import { base, CAP, TTL, USDC } from './config';
import { exactAmount } from './amounts';
import { AppError } from './errors';
const address = z.string().refine(v => isAddress(v, { strict: false }) && v.toLowerCase() !== zeroAddress).transform(v => v as Address);
const hex = z.string().regex(/^0x[0-9a-fA-F]+$/);
const dataHex = z.string().regex(/^0x(?:[0-9a-fA-F]{2}){4,}$/).transform(v => v as Hex);
const wireTx = z.object({
  from: address, to: address, chain_id: hex, value: hex, data: dataHex,
  type: z.enum(['0x0', '0x1', '0x2']).optional(), nonce: hex.optional(), gas: hex.optional(),
  gas_price: hex.optional(), max_fee: hex.optional(), max_priority_fee: hex.optional(),
}).strict();
const quantity = z.object({ quantity: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/) });
const feeSchema = z.object({ amount: quantity.extend({ usd_value: z.number().nonnegative().optional() }), included_in_rate: z.boolean().optional(), percentage: z.number().nonnegative().optional(), fungible: z.object({ id: z.string() }).optional() });
const relation = z.object({ data: z.object({ id: z.string() }) });
const wireQuote = z.object({ id: z.string(), attributes: z.object({
  liquidity_source: z.object({ id: z.string(), name: z.string() }), input_amount: quantity, output_amount: quantity,
  minimum_output_amount: quantity, slippage_percent: z.number(),
  protocol_fee: feeSchema.nullish(), network_fee: feeSchema.nullish(), bridge_fee: z.unknown().optional(),
  error: z.object({ code: z.string() }).nullish(),
  transaction_swap: z.object({ evm: wireTx }).strict().nullish(), transaction_approve: z.object({ evm: wireTx }).strict().nullish(),
}).passthrough(), relationships: z.object({ input_chain: relation, output_chain: relation, input_fungible: relation, output_fungible: relation }) });
export type Transaction = { to: Address; data: Hex; value: '0' };
export type Fee = { label: string; inclusion: string };
export type Quote = {
  mode: 'live' | 'simulation'; requestId: string; providerId: string; account: Address; chain: 8453;
  sell: string; expected: string; minimum: string; sourceId: string; sourceName: string; fetchedAt: number; validUntil: number;
  networkFee: Fee; providerFee: Fee; spender: Address | null; approval: Transaction | null; swap: Transaction | null;
  executable: boolean; blockedReason: string | null;
};
function fail() { throw new AppError('QUOTE_INVALID', 'The quote did not match this swap. Wallet actions are disabled.', 502); }
function validateTx(tx: z.infer<typeof wireTx>, account: Address) {
  if (tx.from.toLowerCase() !== account.toLowerCase() || BigInt(tx.chain_id) !== BigInt(base.id) || BigInt(tx.value) !== 0n || (tx.gas_price && (tx.max_fee || tx.max_priority_fee))) fail();
}
function fee(raw: z.infer<typeof feeSchema> | null | undefined): Fee {
  if (!raw) return { label: 'Unavailable', inclusion: 'Final fee shown in your wallet.' };
  const label = raw.amount.quantity === '0' ? '0' : raw.amount.usd_value !== undefined ? `$${raw.amount.usd_value.toFixed(4)}` : raw.percentage !== undefined ? `${raw.percentage}%` : raw.fungible?.id === 'eth' ? `${raw.amount.quantity} ETH` : 'Unavailable';
  return { label, inclusion: raw.included_in_rate === true ? 'Included in quoted rate.' : raw.included_in_rate === false ? 'Not included in quoted rate.' : 'Fee inclusion unavailable.' };
}
export function normalizeQuote(raw: unknown, account: Address, amount: bigint, assets: { sell: string; buy: string }, pinnedSource: string, now = Date.now()): Quote {
  const result = wireQuote.safeParse(raw);
  if (!result.success) return fail();
  const { id, attributes: a, relationships: r } = result.data;
  if (a.liquidity_source.id !== 'kyber' || a.bridge_fee != null || r.input_chain.data.id !== 'base' || r.output_chain.data.id !== 'base' || r.input_fungible.data.id !== assets.sell || r.output_fungible.data.id !== assets.buy || a.slippage_percent !== 0.5 || exactAmount(a.input_amount.quantity) !== amount || amount > CAP) fail();
  // Reject extension fields associated with non-atomic signing even if metadata evolves.
  if (Object.keys(a).some(k => /permit|signature|typed_data|batch|paymaster/i.test(k))) fail();
  const expected = parseUnits(a.output_amount.quantity, 18), minimum = parseUnits(a.minimum_output_amount.quantity, 18);
  if (expected <= 0n || minimum <= 0n || minimum > expected) fail();
  const swap = a.transaction_swap?.evm, approval = a.transaction_approve?.evm;
  let spender: Address | null = null, exactApproval: Transaction | null = null;
  if (swap) validateTx(swap, account);
  if (approval) {
    validateTx(approval, account);
    if (approval.to.toLowerCase() !== USDC.toLowerCase()) fail();
    try {
      const decoded = decodeFunctionData({ abi: erc20Abi, data: approval.data });
      if (decoded.functionName !== 'approve' || decoded.args[0] === zeroAddress) fail();
      spender = decoded.args[0] as Address;
      exactApproval = { to: USDC, value: '0', data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] }) };
    } catch { fail(); }
  }
  const blockedReason = a.error ? (a.error.code === 'not_enough_input_asset_balance' ? 'Your Base USDC balance is too low for this quote.' : 'The provider could not prepare an executable swap.') : !swap ? 'This quote has no executable transaction.' : pinnedSource !== 'kyber' ? 'Live execution awaits verification and pinning of an atomic route.' : null;
  return { mode: 'live', requestId: crypto.randomUUID(), providerId: id, account, chain: 8453, sell: amount.toString(), expected: a.output_amount.quantity, minimum: a.minimum_output_amount.quantity, sourceId: a.liquidity_source.id, sourceName: a.liquidity_source.name, fetchedAt: now, validUntil: now + TTL, networkFee: fee(a.network_fee), providerFee: fee(a.protocol_fee), spender, approval: exactApproval, swap: swap ? { to: swap.to, value: '0', data: swap.data } : null, executable: !blockedReason, blockedReason };
}
export function assertSignable(q: Quote, account: Address, chainId: number, now = Date.now()) {
  if (q.mode !== 'live' || !q.executable || !q.swap || q.sourceId !== 'kyber') throw new AppError('DISABLED', 'This quote cannot request a wallet signature.');
  if (q.account.toLowerCase() !== account.toLowerCase() || chainId !== base.id) throw new AppError('WALLET_CHANGED', 'Your account or network changed. Review a new quote.');
  if (now >= q.validUntil) throw new AppError('EXPIRED', 'Refresh this quote before continuing.');
}
