import { z } from 'zod';
import { isAddress } from 'viem';
import type { Pending } from './transactions';
const schema = z.object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), chain: z.union([z.literal(1), z.literal(42161)]), account: z.string().refine(v => isAddress(v, { strict: false })), sell: z.string().regex(/^[1-9][0-9]{0,15}$/), expected: z.string().regex(/^\d+(\.\d{1,18})?$/), source: z.string().max(80), minimum: z.string().regex(/^\d+(\.\d{1,18})?$/).optional(), sourceConfirmed: z.boolean().optional(), replaced: z.boolean().optional() }).strict();
export const STORAGE_KEY = 'zerion-agent.arbitrum.pending.v1';
export function restore(raw: string | null): Pending | null {
  try { const value = schema.safeParse(JSON.parse(raw || 'null')); return value.success ? value.data as Pending : null; } catch { return null; }
}
export function savePending(p: Pending) { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* Receipt remains in memory if storage is unavailable. */ } }
export function clearPending() { try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Optional browser storage. */ } }
