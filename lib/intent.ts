import { z } from 'zod';
import { routeSchema, legacyRoute, type Route } from './routes';
import { AppError } from './errors';
export const IntentSchema = z.object({
  route: routeSchema.optional(),
  status: z.enum(['ready', 'needs_clarification', 'unsupported']),
  sellToken: z.enum(['ETH', 'USDC', 'other']).nullable(), buyToken: z.enum(['USDC', 'ETH', 'other']).nullable(),
  chain: z.enum(['arbitrum', 'ethereum', 'base', 'other']).nullable(), amountType: z.enum(['percentage', 'exact', 'usd']).nullable(),
  amount: z.string().nullable(), recipient: z.enum(['self', 'other']).nullable(),
  reason: z.enum(['none', 'missing_amount', 'missing_asset', 'unsupported_request']),
}).strict();
export type Intent = z.infer<typeof IntentSchema>;
export type ReadyIntent = Intent & { status: 'ready'; amountType: 'percentage' | 'exact' | 'usd'; amount: string };
export const decimal = /^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/;
export function validateIntent(raw: unknown): ReadyIntent {
  const parsed = IntentSchema.safeParse(raw);
  if (!parsed.success) throw new AppError('INVALID_INTENT', 'The interpretation was incomplete. Please try again.');
  const i = parsed.data;
  if (i.status !== 'ready') throw new AppError(i.status, i.reason === 'missing_amount' ? 'Include an amount, like half, $2, or 0.001 ETH.' : i.reason === 'missing_asset' ? 'Include both assets: swap half my ETH for USDC.' : 'Swap or bridge ETH and USDC between Ethereum, Arbitrum and Base. Other tokens and networks are not enabled.');
  if (!i.route && (i.sellToken !== 'ETH' || !((i.buyToken === 'USDC' && (i.chain === 'arbitrum' || i.chain === 'base')) || (i.buyToken === 'ETH' && i.chain === 'ethereum')) || i.recipient !== 'self' || i.reason !== 'none' || !i.amountType || !i.amount || !decimal.test(i.amount) || !/[1-9]/.test(i.amount))) throw new AppError('INVALID_INTENT', 'This instruction is outside the supported action. Please rephrase it.');
  if (i.route && (i.sellToken !== i.route.sellToken || i.buyToken !== i.route.buyToken || i.recipient !== 'self' || i.reason !== 'none' || !i.amountType || !i.amount || !decimal.test(i.amount) || !/[1-9]/.test(i.amount))) throw new AppError('INVALID_INTENT', 'The route or amount is invalid.');
  if (i.route?.sellToken === 'USDC' && i.amountType === 'exact' && !/^[0-9]+(?:\.[0-9]{1,6})?$/.test(i.amount!)) throw new AppError('PRECISION', 'USDC supports up to six decimals.');
  if (i.amountType === 'percentage' && !/^[1-9][0-9]?$|^100$/.test(i.amount!)) throw new AppError('INVALID_AMOUNT', 'Use a whole percentage from 1 to 100.');
  if (i.amountType === 'usd' && !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(i.amount!)) throw new AppError('INVALID_AMOUNT', 'Use a dollar amount with at most two decimal places.');
  return i as ReadyIntent;
}
export function guardText(text: string) {
  if (!text.trim() || text.length > 160) throw new AppError('INVALID_TEXT', 'Enter one instruction, up to 160 characters.');
  if (/0x[a-f\d]{40}|\b[\w-]+\.eth\b/i.test(text) || (text.match(/\d+(?:\.\d+)?/g)?.length ?? 0) > 1) throw new AppError('unsupported', 'Use one input amount and your connected wallet as the recipient.');
}

export function intentRoute(i: ReadyIntent): Route { return i.route ?? legacyRoute(i.chain === 'ethereum' ? 1 : 42161, i.chain === 'base' ? 8453 : undefined); }
