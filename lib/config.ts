import { arbitrum, mainnet } from 'viem/chains';
export { arbitrum, mainnet };
export const ETHEREUM_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;
export const BRIDGE_EXAMPLE = 'Bridge 0.001 ETH from Ethereum to Arbitrum';
export const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const;
export const CAP = 2_000_000_000_000_000n; // 0.002 ETH, not a USD-denominated cap.
export const TTL = 30_000;
export const EXAMPLE = 'Swap half my ETH for USDC';
export type Mode = 'simulation' | 'live';
