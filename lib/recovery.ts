import { z } from 'zod';
import { isAddress } from 'viem';
import type { Pending } from './transactions';
const schema = z.object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), chain: z.literal(8453), account: z.string().refine(v => isAddress(v, { strict: false })), stage: z.enum(['approval', 'swap']), sell: z.string().regex(/^[1-9][0-9]{0,7}$/), expected: z.string().regex(/^\d+(\.\d{1,18})?$/), source: z.string().max(80), spender: z.string().refine(v => isAddress(v, { strict: false })).nullable() }).strict();
export const STORAGE_KEY = 'half.pending.v1';
export function restore(raw: string | null): Pending | null {
  try { const value = schema.safeParse(JSON.parse(raw || 'null')); return value.success ? value.data as Pending : null; } catch { return null; }
}
export function savePending(p: Pending) { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* Receipt remains in memory if storage is unavailable. */ } }
export function clearPending() { try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Optional browser storage. */ } }
