import { z } from 'zod';
import { isAddress, type Hash } from 'viem';
import { handle } from '@/lib/http.server';
import { bridgeResult } from '@/lib/bridge-status';
import { publicClient } from '@/lib/rpc';
import { AppError } from '@/lib/errors';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return handle(request, 'bridgeStatus', z.object({ hash: z.string().regex(/^0x[\da-fA-F]{64}$/), account: z.string().refine(v => isAddress(v, { strict: false })), minimum: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/) }).strict(), async ({ hash, account, minimum }) => {
    const url = new URL('https://li.quest/v1/status'); url.search = new URLSearchParams({ txHash: hash, fromChain: '1', toChain: '42161' }).toString();
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (response.status === 404) {
      const error = z.object({ code: z.number() }).safeParse(await response.json());
      if (error.success && error.data.code === 1003) return { complete: false, destinationHash: null, message: 'Bridge not indexed yet. Keep your transaction hash and check again.' };
    }
    if (!response.ok) throw new AppError('BRIDGE_STATUS', 'Bridge tracking is temporarily unavailable. Keep the transaction hash and check again.', 503);
    const result = bridgeResult(await response.json(), hash, account, minimum);
    if (result.complete && result.destinationHash) {
      const receipt = await publicClient.getTransactionReceipt({ hash: result.destinationHash as Hash });
      if (receipt.status !== 'success') throw new AppError('BRIDGE_STATUS', 'Destination receipt is not successful. Check the transfer explorer.');
    }
    return result;
  });
}
