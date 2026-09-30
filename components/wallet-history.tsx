'use client';
import { displayAmount } from '@/lib/display-amount';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import type { HistoryItem } from '@/lib/history';
import type { Pending } from '@/lib/transactions';
export function WalletHistory({ account, pending }: { account?: Address; pending?: Pending }) {
  const history = useInfiniteQuery({ queryKey: ['wallet-history', account?.toLowerCase()], enabled: !!account, initialPageParam: null as string | null, staleTime: 30000,
    queryFn: async ({ pageParam, signal }) => {
      const response = await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, cursor: pageParam }), signal });
      if (!response.ok) throw new Error('History unavailable');
      return await response.json() as { items: HistoryItem[]; cursor: string | null };
    }, getNextPageParam: (last, pages) => last.cursor && !pages.slice(0, -1).some(p => p.cursor === last.cursor) ? last.cursor : undefined,
  });
  const items = [...new Map(history.data?.pages.flatMap(p => p.items).map(t => [t.id, t]) ?? []).values()];
  const active = pending && pending.account.toLowerCase() === account?.toLowerCase() && (pending.chain === 1 || pending.destination === 8453 || !items.some(t => t.hash.toLowerCase() === pending.hash.toLowerCase())) ? pending : null;
  return <aside className="history-sidebar" aria-label="Wallet history">
    <div className="history-heading"><h2>History</h2>{account && <button className="text-button" disabled={history.isFetching} onClick={() => void history.refetch()}>Refresh</button>}</div>
    {!account ? <p className="history-empty">Connect your wallet to see its transactions.</p> : <>
      <p className="history-scope">All networks</p>
      {active && <a className="history-item" href={`${active.chain === 1 ? 'https://etherscan.io' : 'https://arbiscan.io'}/tx/${active.hash}`} target="_blank" rel="noreferrer"><strong>{active.chain === 1 || active.destination === 8453 ? 'Bridge in progress' : 'Transaction pending'} ↗</strong><span>{active.sourceConfirmed ? `Waiting for delivery on ${active.destination === 8453 ? 'Base' : 'Arbitrum'}` : 'Waiting for source confirmation'}</span></a>}
      {history.isPending && <p className="history-empty" role="status">Loading transactions…</p>}
      {history.isError && <p className="history-empty" role="alert">Couldn’t load history. Try refreshing.</p>}
      {!history.isPending && !history.isError && !items.length && !active && <p className="history-empty">No transactions yet.</p>}
      <ol className="history-list">{items.map(t => <li key={t.id}><a className="history-item" href={t.chain === 'ethereum' || t.chain === 'arbitrum' ? `https://${t.chain === 'ethereum' ? 'etherscan.io' : 'arbiscan.io'}/tx/${t.hash}` : `https://app.zerion.io/${account}/history`} target="_blank" rel="noreferrer">
        <div><strong>{t.operation.replaceAll('_', ' ')}</strong><span aria-hidden="true">↗</span></div>
        <span>{t.chain} · {t.status}</span>
        {t.transfers.slice(0, 2).map((v, i) => <span key={i} className="history-amount" title={`${v.amount} ${v.symbol}`}>{v.incoming ? '+' : '−'}{displayAmount(v.amount)} {v.symbol}{v.unverified ? ' (unverified)' : ''}</span>)}
        {t.spam && <span>Flagged as spam</span>}
        <time dateTime={t.date ?? undefined}>{t.date ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}</time>
      </a></li>)}</ol>
      {history.hasNextPage && <button className="text-button" disabled={history.isFetching} onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage ? 'Loading…' : 'Load older transactions'}</button>}
    </>}
  </aside>;
}
