import { z } from 'zod';
import { isAddress, zeroAddress, type Address } from 'viem';
import { handle, appMode } from '@/lib/http.server';
import { getQuote, getBridgeQuote } from '@/lib/zerion.server';
import { readBalances } from '@/lib/rpc';
import { CAP } from '@/lib/config';
import { AppError } from '@/lib/errors';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return handle(request, 'quote', z.object({ action: z.enum(['swap', 'bridge']).default('swap'), account: z.string().refine(v => isAddress(v, { strict: false }) && v.toLowerCase() !== zeroAddress), sellAmountBaseUnits: z.string().regex(/^[1-9][0-9]{0,15}$/) }).strict(), async ({ account, sellAmountBaseUnits, action }) => {
    if (appMode() !== 'live') throw new AppError('MODE', 'Live quotes are disabled in simulation.');
    const amount = BigInt(sellAmountBaseUnits); if (amount > CAP) throw new AppError('CAP', 'This prototype supports swaps up to 0.002 ETH.');
    const balances = await readBalances(account as Address, action === 'bridge' ? 1 : 42161);
    if (action !== 'bridge' && balances.eth <= amount) throw new AppError('BALANCE', 'Leave some ETH on Arbitrum for network fees.');
    return { quote: await (action === 'bridge' ? getBridgeQuote : getQuote)(account as Address, amount) };
  });
}
