import { formatUnits, type Address } from 'viem';
import { TTL } from './config';
import type { Quote } from './quote';
import { AppError } from './errors';
export const SIM_ACCOUNT: Address = '0x1111111111111111111111111111111111111111';
export const SIM_BALANCE = 10_000_000n;
export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export function simulatedQuote(amount: bigint): Quote {
  const now = Date.now(); const output = amount * 10n ** 12n / 2700n;
  return { mode: 'simulation', requestId: crypto.randomUUID(), providerId: 'simulation', account: SIM_ACCOUNT, chain: 8453, sell: amount.toString(), expected: formatUnits(output, 18), minimum: formatUnits(output * 995n / 1000n, 18), sourceId: 'simulation', sourceName: 'Simulated route', fetchedAt: now, validUntil: now + TTL, networkFee: { label: '~$0.01', inclusion: 'Illustrative only; not a live estimate.' }, providerFee: { label: '$0.00', inclusion: 'Simulated fee.' }, spender: null, approval: null, swap: null, executable: false, blockedReason: null };
}
export async function simulateStep(q: Quote) {
  if (q.mode !== 'simulation' || q.approval || q.swap || q.executable) throw new AppError('MODE', 'Simulation cannot execute transaction payloads.');
  await pause(850);
}
