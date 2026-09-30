import { z } from 'zod';
import { zeroAddress } from 'viem';
import { arbitrum, mainnet, base, USDC, BASE_USDC, ETHEREUM_USDC, CAP } from './config';
export const chainSchema = z.union([z.literal(1), z.literal(42161), z.literal(8453)]);
export const tokenSchema = z.enum(['ETH', 'USDC']);
export const routeSchema = z.object({ from: chainSchema, to: chainSchema, sellToken: tokenSchema, buyToken: tokenSchema }).strict().refine(r => r.from !== r.to || r.sellToken !== r.buyToken, 'Choose another token or destination network.');
export type ChainId = z.infer<typeof chainSchema>;
export type Token = z.infer<typeof tokenSchema>;
export type Route = z.infer<typeof routeSchema>;
export const chains = { 1: mainnet, 42161: arbitrum, 8453: base };
export const chainSlug = (id: ChainId) => id === 1 ? 'ethereum' : id === 8453 ? 'base' : 'arbitrum';
export const chainName = (id: ChainId) => id === 1 ? 'Ethereum' : id === 8453 ? 'Base' : 'Arbitrum';
export const tokenAddress = (id: ChainId, token: Token) => token === 'ETH' ? zeroAddress : id === 1 ? ETHEREUM_USDC : id === 8453 ? BASE_USDC : USDC;
export const tokenDecimals = (token: Token) => token === 'ETH' ? 18 : 6;
export const tokenCap = (token: Token) => token === 'ETH' ? CAP : 20_000_000n;
export function legacyRoute(chain: number, destination?: number): Route {
  return { from: chain as ChainId, to: (destination ?? 42161) as ChainId, sellToken: 'ETH', buyToken: chain === 1 && !destination ? 'ETH' : 'USDC' };
}
export function quoteRoute(q: { chain: number; destination?: number; route?: Route }): Route { return q.route ?? legacyRoute(q.chain, q.destination); }
