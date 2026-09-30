import { legacyRoute, tokenAddress, tokenDecimals, type Route } from './routes';
import { z } from 'zod';
import { parseUnits, type Hash } from 'viem';
import { AppError } from './errors';
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const schema = z.object({ status: z.string(), substatus: z.string().optional(), fromAddress: z.string().optional(), toAddress: z.string().optional(), sending: z.object({ txHash: hash, chainId: z.number() }).optional(), receiving: z.object({ txHash: hash, chainId: z.number(), amount: z.string().regex(/^\d+$/), token: z.object({ address: z.string(), decimals: z.number() }) }).optional() });
export function bridgeResult(raw: unknown, txHash: string, account: string, minimum: string, baseRoute = false, selectedRoute?: Route) {
  const route = selectedRoute ?? legacyRoute(baseRoute ? 42161 : 1, baseRoute ? 8453 : undefined);
  const value = schema.parse(raw);
  const pending = { complete: false, message: selectedRoute ? 'Source transaction confirmed. Waiting for destination delivery.' : baseRoute ? 'Arbitrum deposit confirmed. Waiting for USDC on Base.' : 'Ethereum deposit confirmed. Waiting for delivery on Arbitrum.', destinationHash: null as Hash | null };
  if (value.status === 'NOT_FOUND' || value.status === 'PENDING') return pending;
  if (!value.sending || value.sending.txHash.toLowerCase() !== txHash.toLowerCase() || value.sending.chainId !== route.from || value.fromAddress?.toLowerCase() !== account.toLowerCase() || value.toAddress?.toLowerCase() !== account.toLowerCase()) throw new AppError('BRIDGE_STATUS', 'The provider status does not match this bridge. Check the transfer explorer.');
  if (value.status !== 'DONE' || value.substatus !== 'COMPLETED') return { ...pending, message: value.substatus === 'REFUNDED' ? 'Provider reports a refund. Check the transfer explorer and your source-network balance.' : value.substatus === 'PARTIAL' ? 'Provider reports partial delivery. Check the transfer explorer before taking another action.' : 'The bridge needs attention. Check the transfer explorer; do not send again.' };
  const received = value.receiving;
  if (!received || received.chainId !== route.to || received.token.address.toLowerCase() !== tokenAddress(route.to, route.buyToken).toLowerCase() || received.token.decimals !== tokenDecimals(route.buyToken) || BigInt(received.amount) < parseUnits(minimum, tokenDecimals(route.buyToken)) || BigInt(received.amount) <= 0n) throw new AppError('BRIDGE_STATUS', 'The destination transfer could not be verified. Check the transfer explorer.');
  return { complete: true, message: selectedRoute ? 'Destination delivery verified.' : baseRoute ? 'USDC delivered on Base.' : 'ETH delivered on Arbitrum.', destinationHash: received.txHash as Hash };
}
