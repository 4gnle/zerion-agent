import { formatUnits, type Address } from 'viem';
import { TTL } from './config';
import type { Quote } from './quote';
import { AppError } from './errors';
export const SIM_ACCOUNT: Address = '0x1111111111111111111111111111111111111111';
export const SIM_BALANCE = 2_000_000_000_000_000n;
export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export function simulatedQuote(amount: bigint, bridge = false, baseRoute = false): Quote {
  const now = Date.now(); const output = bridge ? amount * 99n / 100n : amount * 2700n / 10n ** 12n;
  return { mode: 'simulation', ...(baseRoute ? { destination: 8453 as const } : {}), requestId: crypto.randomUUID(), providerId: 'simulation', account: SIM_ACCOUNT, chain: bridge ? 1 : 42161, sell: amount.toString(), expected: formatUnits(output, bridge ? 18 : 6), minimum: formatUnits(output * 995n / 1000n, bridge ? 18 : 6), sourceId: 'simulation', sourceName: 'Simulated route', fetchedAt: now, validUntil: now + TTL, networkFee: { label: '~$0.01', inclusion: 'Illustrative only; not a live estimate.' }, providerFee: { label: '$0.00', inclusion: 'Simulated fee.' }, swap: null, executable: false, blockedReason: null };
}
export async function simulateStep(q: Quote) {
  if (q.mode !== 'simulation' || q.swap || q.executable) throw new AppError('MODE', 'Simulation cannot execute transaction payloads.');
  await pause(850);
}
