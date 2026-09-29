import type { Hash } from 'viem';
import type { Pending } from './transactions';
export async function bridgeStatus(record: Pending) {
  const response = await fetch('/api/bridge-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: record.hash, account: record.account, minimum: record.minimum ?? record.expected }), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Bridge status unavailable');
  return await response.json() as { complete: boolean; destinationHash: Hash | null; message: string };
}
