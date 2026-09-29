import { z } from 'zod';
import { isAddress } from 'viem';
import { handle } from '@/lib/http.server';
import { zerionGet } from '@/lib/zerion.server';
import { normalizeHistory } from '@/lib/history';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return handle(request, 'history', z.object({ account: z.string().refine(v => isAddress(v, { strict: false })), cursor: z.string().max(1024).regex(/^[a-zA-Z0-9+/=_-]+$/).nullish() }).strict(), async ({ account, cursor }) => {
    const params = new URLSearchParams({ currency: 'usd', 'page[size]': '20' });
    if (cursor) params.set('page[after]', cursor);
    return normalizeHistory(await zerionGet(`/v1/wallets/${account}/transactions/`, params));
  });
}
