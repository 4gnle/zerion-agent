'use client';
import { displayAmount } from '@/lib/display-amount';
import { useQuery } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, formatUnits, type Address } from 'viem';
import { USDC, BASE_USDC, arbitrum } from '@/lib/config';

// Native USDC deployments: https://developers.circle.com/stablecoins/usdc-contract-addresses
const ethereumUSDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export function WalletBalances({ account, chainId }: { account: Address; chainId: number | undefined }) {
  const config = useConfig();
  const supported = chainId === arbitrum.id || chainId === 1 || chainId === 8453;
  const balances = useQuery({
    queryKey: ['wallet-balances', account.toLowerCase(), chainId],
    enabled: supported,
    staleTime: 15000,
    queryFn: async () => {
      if (!supported) throw new Error('Unsupported network');
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('Network unavailable');
      const token = chainId === arbitrum.id ? USDC : chainId === 8453 ? BASE_USDC : ethereumUSDC;
      const [eth, usdc, decimals] = await Promise.all([
        client.getBalance({ address: account }),
        client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
        client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
      ]);
      if (decimals !== 6) throw new Error('Unexpected token metadata');
      return { eth: formatUnits(eth, 18), usdc: formatUnits(usdc, 6) };
    },
  });
  if (!supported) return <p className="balance-note">Connect to Arbitrum, Ethereum or Base to see your balances.</p>;
  return <section className="wallet-balances" aria-label="Wallet balances" aria-busy={balances.isFetching}>
    <div className="balance-heading"><p>Your balance <span>on {chainId === arbitrum.id ? 'Arbitrum' : chainId === 8453 ? 'Base' : 'Ethereum'}</span></p><button className="text-button" onClick={() => void balances.refetch()} disabled={balances.isFetching}>{balances.isFetching ? 'Updating…' : 'Refresh'}</button></div>
    {balances.isError ? <p className="balance-note" role="alert">Couldn’t load your balances. Try refreshing.</p> : <dl className="balance-grid">
      <div><dt>ETH</dt><dd title={balances.data?.eth}>{balances.data ? displayAmount(balances.data.eth) : '…'}</dd></div>
      <div><dt>USDC</dt><dd title={balances.data?.usdc}>{balances.data ? displayAmount(balances.data.usdc) : '…'}</dd></div>
    </dl>}
  </section>;
}
