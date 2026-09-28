import { createPublicClient, http, erc20Abi, type Address } from 'viem';
import { base, USDC } from './config';
import { AppError } from './errors';
export const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org', { retryCount: 0, timeout: 15000 }) });
let decimalsChecked = false;
export async function readBalances(account: Address) {
  if (!decimalsChecked) {
    if (await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'decimals' }) !== 6) throw new AppError('METADATA', 'Unexpected USDC metadata.');
    decimalsChecked = true;
  }
  const [usdc, eth, code] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    publicClient.getBalance({ address: account }), publicClient.getCode({ address: account }),
  ]);
  if (code && code !== '0x') throw new AppError('ACCOUNT_TYPE', 'This demo supports ordinary EOA wallets only, without delegated code.');
  return { usdc, eth };
}
export const allowance = (account: Address, spender: Address) => publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'allowance', args: [account, spender] });
