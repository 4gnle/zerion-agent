import { z } from 'zod';
import { isAddress, zeroAddress, type Address } from 'viem';
import { handle, appMode } from '@/lib/http.server';
import { getQuote } from '@/lib/zerion.server';
import { readBalances } from '@/lib/rpc';
import { CAP } from '@/lib/config';
import { AppError } from '@/lib/errors';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return handle(request, 'quote', z.object({ account: z.string().refine(v => isAddress(v, { strict: false }) && v.toLowerCase() !== zeroAddress), sellAmountBaseUnits: z.string().regex(/^[1-9][0-9]{0,7}$/) }).strict(), async ({ account, sellAmountBaseUnits }) => {
    if (appMode() !== 'live') throw new AppError('MODE', 'Live quotes are disabled in simulation.');
    const amount = BigInt(sellAmountBaseUnits); if (amount > CAP) throw new AppError('CAP', 'This prototype supports swaps up to 10 USDC.');
    const balances = await readBalances(account as Address);
    if (balances.usdc < amount) throw new AppError('BALANCE', 'Your Base balance is lower than this amount.');
    return { quote: await getQuote(account as Address, amount) };
  });
}
