import { z } from 'zod';
import { parseEther, zeroAddress, type Hash } from 'viem';
import { AppError } from './errors';
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const schema = z.object({ status: z.string(), substatus: z.string().optional(), fromAddress: z.string().optional(), toAddress: z.string().optional(), sending: z.object({ txHash: hash, chainId: z.number() }).optional(), receiving: z.object({ txHash: hash, chainId: z.number(), amount: z.string().regex(/^\d+$/), token: z.object({ address: z.string(), decimals: z.number() }) }).optional() });
export function bridgeResult(raw: unknown, txHash: string, account: string, minimum: string) {
  const value = schema.parse(raw);
  const pending = { complete: false, message: 'Ethereum deposit confirmed. Waiting for delivery on Arbitrum.', destinationHash: null as Hash | null };
  if (value.status === 'NOT_FOUND' || value.status === 'PENDING') return pending;
  if (!value.sending || value.sending.txHash.toLowerCase() !== txHash.toLowerCase() || value.sending.chainId !== 1 || value.fromAddress?.toLowerCase() !== account.toLowerCase() || value.toAddress?.toLowerCase() !== account.toLowerCase()) throw new AppError('BRIDGE_STATUS', 'The provider status does not match this bridge. Check the transfer explorer.');
  if (value.status !== 'DONE' || value.substatus !== 'COMPLETED') return { ...pending, message: value.substatus === 'REFUNDED' ? 'Provider reports a refund. Check the transfer explorer and your Ethereum balance.' : value.substatus === 'PARTIAL' ? 'Provider reports partial delivery. Check the transfer explorer before taking another action.' : 'The bridge needs attention. Check the transfer explorer; do not send again.' };
  const received = value.receiving;
  if (!received || received.chainId !== 42161 || received.token.address.toLowerCase() !== zeroAddress || received.token.decimals !== 18 || BigInt(received.amount) < parseEther(minimum) || BigInt(received.amount) <= 0n) throw new AppError('BRIDGE_STATUS', 'The destination transfer could not be verified. Check the transfer explorer.');
  return { complete: true, message: 'ETH delivered on Arbitrum.', destinationHash: received.txHash as Hash };
}
