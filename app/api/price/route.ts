import { z } from 'zod';
import { handle, appMode } from '@/lib/http.server';
import { ethPrice } from '@/lib/zerion.server';
export async function POST(request: Request) { return handle(request, 'price', z.object({}).strict(), async () => appMode() === 'simulation' ? { price: '2700', fetchedAt: Date.now(), simulated: true } : ethPrice()); }
