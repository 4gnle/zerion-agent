import { base } from 'viem/chains';
export { base };
export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
export const CAP = 10_000_000n;
export const TTL = 30_000;
export const EXAMPLE = 'Swap half my USDC for ETH';
export type Mode = 'simulation' | 'live';
