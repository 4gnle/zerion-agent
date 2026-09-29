import { z } from 'zod';
const transfer = z.object({ direction: z.string(), quantity: z.object({ numeric: z.string().max(100) }), fungible_info: z.object({ symbol: z.string().max(80), flags: z.object({ verified: z.boolean().optional() }).optional() }).nullish() });
const transaction = z.object({ id: z.string(), attributes: z.object({ hash: z.string().regex(/^0x[\da-fA-F]{64}$/), operation_type: z.string(), status: z.string(), mined_at: z.string().nullish(), transfers: z.array(transfer).optional(), flags: z.object({ is_trash: z.boolean().optional() }).optional() }), relationships: z.object({ chain: z.object({ data: z.object({ id: z.string() }) }) }) });
export type HistoryItem = { id: string; hash: string; operation: string; status: string; date: string | null; chain: string; spam: boolean; transfers: { amount: string; symbol: string; incoming: boolean; unverified: boolean }[] };
export function normalizeHistory(raw: unknown) {
  const response = z.object({ data: z.array(z.unknown()), links: z.object({ next: z.string().nullish() }).optional() }).parse(raw);
  const items: HistoryItem[] = response.data.map(value => {
    const { id, attributes: a, relationships: r } = transaction.parse(value);
    return { id, hash: a.hash, operation: a.operation_type, status: a.status, date: a.mined_at ?? null, chain: r.chain.data.id, spam: !!a.flags?.is_trash, transfers: (a.transfers ?? []).map(t => ({ amount: t.quantity.numeric, symbol: t.fungible_info?.symbol ?? 'NFT', incoming: t.direction === 'in', unverified: t.fungible_info?.flags?.verified !== true })) };
  });
  // Only the cursor is reused; never fetch an upstream-supplied URL.
  const cursor = response.links?.next && items.length ? new URL(response.links.next).searchParams.get('page[after]') : null;
  return { items, cursor };
}
