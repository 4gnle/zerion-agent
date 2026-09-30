import { routeSchema, tokenCap, legacyRoute } from '@/lib/routes';
import { z } from 'zod';
import { isAddress, zeroAddress, type Address } from 'viem';
import { handle, appMode } from '@/lib/http.server';
import { getQuote, getBridgeQuote, getBaseQuote, getRouteQuote } from '@/lib/zerion.server';
import { readBalances } from '@/lib/rpc';
import { AppError } from '@/lib/errors';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return handle(request, 'quote', z.object({ route: routeSchema.optional(), action: z.enum(['swap', 'bridge', 'base']).default('swap'), account: z.string().refine(v => isAddress(v, { strict: false }) && v.toLowerCase() !== zeroAddress), sellAmountBaseUnits: z.string().regex(/^[1-9][0-9]{0,15}$/) }).strict(), async ({ account, sellAmountBaseUnits, action, route }) => {
    if (appMode() !== 'live') throw new AppError('MODE', 'Live quotes are disabled in simulation.');
    const selected = route ?? legacyRoute(action === 'bridge' ? 1 : 42161, action === 'base' ? 8453 : undefined);
    const amount = BigInt(sellAmountBaseUnits); if (amount > tokenCap(selected.sellToken)) throw new AppError('CAP', 'This amount exceeds the demo limit (0.002 ETH or 20 USDC).');
    const balances = await readBalances(account as Address, selected.from);
    if (selected.sellToken === 'ETH' ? balances.eth <= amount : balances.usdc < amount || balances.eth === 0n) throw new AppError('BALANCE', 'Insufficient input balance or source-network ETH for gas.');
    if (route) return { quote: await getRouteQuote(account as Address, amount, route) };
    return { quote: await (action === 'bridge' ? getBridgeQuote : action === 'base' ? getBaseQuote : getQuote)(account as Address, amount) };
  });
}
