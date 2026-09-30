import { z } from 'zod';
import { handle, appMode } from '@/lib/http.server';
import { tokenSchema } from '@/lib/routes';
import { tokenPrice } from '@/lib/zerion.server';
export async function POST(request: Request) { return handle(request, 'price', z.object({ token: tokenSchema.default('ETH') }).strict(), async ({ token }) => appMode() === 'simulation' ? { price: token === 'ETH' ? '2700' : '1', fetchedAt: Date.now(), simulated: true } : tokenPrice(token)); }
