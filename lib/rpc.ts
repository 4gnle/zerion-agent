import { createPublicClient, http, erc20Abi, type Address } from 'viem';
import { arbitrum, mainnet, USDC, ETHEREUM_USDC } from './config';
import { AppError } from './errors';
export const publicClient = createPublicClient({ chain: arbitrum, transport: http('https://arb1.arbitrum.io/rpc', { retryCount: 0, timeout: 15000 }) });
const ethereumClient = createPublicClient({ chain: mainnet, transport: http(undefined, { retryCount: 0, timeout: 15000 }) });
export const clientFor = (chain: number) => chain === 1 ? ethereumClient : publicClient;
const decimalsChecked = new Set<number>();
export async function readBalances(account: Address, chain: 1 | 42161 = 42161) {
  const client = clientFor(chain), token = chain === 1 ? ETHEREUM_USDC : USDC;
  if (!decimalsChecked.has(chain)) {
    if (await client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }) !== 6) throw new AppError('METADATA', 'Unexpected USDC metadata.');
    decimalsChecked.add(chain);
  }
  const [usdc, eth, code] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    client.getBalance({ address: account }), client.getCode({ address: account }),
  ]);
  if (code && code !== '0x') throw new AppError('ACCOUNT_TYPE', 'This demo supports ordinary EOA wallets only, without delegated code.');
  return { usdc, eth };
}
