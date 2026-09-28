import { z } from 'zod';
import { AppError } from './errors';
export const IntentSchema = z.object({
  status: z.enum(['ready', 'needs_clarification', 'unsupported']),
  sellToken: z.enum(['USDC', 'other']).nullable(), buyToken: z.enum(['ETH', 'other']).nullable(),
  chain: z.enum(['base', 'other']).nullable(), amountType: z.enum(['percentage', 'exact']).nullable(),
  amount: z.string().nullable(), recipient: z.enum(['self', 'other']).nullable(),
  reason: z.enum(['none', 'missing_amount', 'missing_asset', 'unsupported_request']),
}).strict();
export type Intent = z.infer<typeof IntentSchema>;
export type ReadyIntent = Intent & { status: 'ready'; amountType: 'percentage' | 'exact'; amount: string };
export const decimal = /^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/;
export function validateIntent(raw: unknown): ReadyIntent {
  const parsed = IntentSchema.safeParse(raw);
  if (!parsed.success) throw new AppError('INVALID_INTENT', 'The interpretation was incomplete. Please try again.');
  const i = parsed.data;
  if (i.status !== 'ready') throw new AppError(i.status, i.reason === 'missing_amount' ? 'Include an amount, like half, 25%, or 2 USDC.' : i.reason === 'missing_asset' ? 'Include both assets: swap half my USDC for ETH.' : 'This demo supports USDC → ETH on Base. Try a single swap with half, a whole percentage, or a USDC amount.');
  if (i.sellToken !== 'USDC' || i.buyToken !== 'ETH' || i.chain !== 'base' || i.recipient !== 'self' || i.reason !== 'none' || !i.amountType || !i.amount || !decimal.test(i.amount) || !/[1-9]/.test(i.amount)) throw new AppError('INVALID_INTENT', 'This instruction is outside the supported swap. Please rephrase it.');
  if (i.amountType === 'percentage' && (!/^[1-9][0-9]?$|^100$/.test(i.amount))) throw new AppError('INVALID_AMOUNT', 'Use a whole percentage from 1 to 100.');
  return i as ReadyIntent;
}
export function guardText(text: string) {
  if (!text.trim() || text.length > 160) throw new AppError('INVALID_TEXT', 'Enter one instruction, up to 160 characters.');
  if (/\$|0x[a-f\d]{40}|\b[\w-]+\.eth\b/i.test(text) || (text.match(/\d+(?:\.\d+)?/g)?.length ?? 0) > 1) throw new AppError('unsupported', 'Use one USDC amount and your connected wallet as the recipient.');
}
