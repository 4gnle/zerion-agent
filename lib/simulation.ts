import { legacyRoute, tokenDecimals, type Route } from './routes';
import { formatUnits, type Address } from 'viem';
import { TTL } from './config';
import type { Quote } from './quote';
import { AppError } from './errors';
export const SIM_ACCOUNT: Address = '0x1111111111111111111111111111111111111111';
export const SIM_BALANCE = 2_000_000_000_000_000n;
export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export function simulatedQuote(amount: bigint, bridge = false, baseRoute = false, selectedRoute?: Route): Quote {
  const now = Date.now(); const route = selectedRoute ?? legacyRoute(bridge ? 1 : 42161, baseRoute ? 8453 : undefined);
  const cross = route.from !== route.to;
  const converted = route.sellToken === route.buyToken ? amount : route.sellToken === 'ETH' ? amount * 2700n / 10n ** 12n : amount * 10n ** 12n / 2700n;
  const output = cross ? converted * 99n / 100n : converted;
  return { mode: 'simulation', ...(selectedRoute ? { route, ...(cross ? { destination: route.to } : {}) } : baseRoute ? { destination: 8453 as const } : {}), requestId: crypto.randomUUID(), providerId: 'simulation', account: SIM_ACCOUNT, chain: route.from, sell: amount.toString(), expected: formatUnits(output, tokenDecimals(route.buyToken)), minimum: formatUnits(output * 995n / 1000n, tokenDecimals(route.buyToken)), sourceId: 'simulation', sourceName: 'Simulated route', fetchedAt: now, validUntil: now + TTL, networkFee: { label: '~$0.01', inclusion: 'Illustrative only; not a live estimate.' }, providerFee: { label: '$0.00', inclusion: 'Simulated fee.' }, swap: null, executable: false, blockedReason: null };
}
export async function simulateStep(q: Quote) {
  if (q.mode !== 'simulation' || q.swap || q.executable) throw new AppError('MODE', 'Simulation cannot execute transaction payloads.');
  await pause(850);
}
