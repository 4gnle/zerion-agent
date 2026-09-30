'use client';
import { displayAmount } from '@/lib/display-amount';
import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletHistory } from './wallet-history';
import { ChainPicker } from './chain-picker';
import { HeaderPopover } from './header-popover';
import { WalletBalances } from './wallet-balances';
import { useConfig, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi';
import { getConnection, getWalletClient } from 'wagmi/actions';
import type { Address } from 'viem';
import { arbitrum, BRIDGE_EXAMPLE, EXAMPLE, USDC, BASE_USDC, type Mode } from '@/lib/config';
import { amountFor, checkFreshBalance, eth, usdToWei } from '@/lib/amounts';
import { validateIntent, type ReadyIntent } from '@/lib/intent';
import { AppError, message } from '@/lib/errors';
import { reducer, unresolved, type Review, type State } from '@/lib/flow';
import { readBalances } from '@/lib/rpc';
import { bridgeStatus } from '@/lib/bridge-monitor';
import { monitor, sendSwap, type Pending } from '@/lib/transactions';
import { clearPending, restore, savePending, STORAGE_KEY } from '@/lib/recovery';
import { pause, SIM_ACCOUNT, SIM_BALANCE, simulatedQuote, simulateStep } from '@/lib/simulation';
import type { Quote } from '@/lib/quote';

async function post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }); }
  catch (e) { if (signal.aborted) throw e; throw new AppError('NETWORK', 'Couldn’t reach the app. Check your connection and try again.'); }
  const data = await response.json();
  if (!response.ok) throw new AppError(data.code || 'REQUEST', data.error || 'This request is unavailable.');
  return data as T;
}
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
function Spinner() { return <span className="spinner" aria-hidden="true" />; }
function Explorer({ hash, chain = 42161 }: { hash: string; chain?: number }) { return <a href={`https://${chain === 1 ? 'etherscan.io' : chain === 8453 ? 'basescan.org' : 'arbiscan.io'}/tx/${hash}`} target="_blank" rel="noreferrer">View on {chain === 1 ? 'Etherscan' : chain === 8453 ? 'Basescan' : 'Arbiscan'} <span aria-hidden="true">↗</span></a>; }

export function SwapScreen({ mode, scripted }: { mode: Mode; scripted: boolean }) {
  const simulation = mode === 'simulation';
  const queryClient = useQueryClient();
  const config = useConfig(); const connection = useConnection(); const connectors = useConnectors();
  const connect = useConnect(); const disconnect = useDisconnect(); const switchChain = useSwitchChain();
  const [state, dispatch] = useReducer(reducer, { phase: 'idle', attempt: 0 });
  const currentState = useRef(state); currentState.current = state;
  const [text, setText] = useState(''); const [sentence, setSentence] = useState('');
  const [walletMenu, setWalletMenu] = useState(false); const [walletError, setWalletError] = useState('');
  const [expiredAt, setExpiredAt] = useState(0); const [copied, setCopied] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null); const busy = useRef(false); const attempt = useRef(0);
  const controller = useRef<AbortController | null>(null); const restored = useRef(false);
  const previousWallet = useRef<string | null>(null);
  const focusRequested = useRef(false);
  const review = 'review' in state ? state.review : undefined;
  const pending = 'pending' in state ? state.pending : undefined;
  const locked = unresolved(state); const reading = state.phase === 'interpreting' || state.phase === 'quoting';
  const walletBusy = connect.isPending || switchChain.isPending;
  const disabled = locked || reading || walletBusy;
  const expired = !!review && expiredAt >= review.quote.validUntil;
  const put = (next: State) => dispatch({ type: 'replace', state: next });
  const freshController = () => { controller.current?.abort(); controller.current = new AbortController(); return controller.current.signal; };
  function matches(id: number, account?: Address, chain = arbitrum.id as number) {
    const live = getConnection(config);
    return id === attempt.current && (simulation || !account || (live.address?.toLowerCase() === account.toLowerCase() && live.chainId === chain));
  }
  function showError(e: unknown, id: number, previous?: Review) {
    if (id !== attempt.current || (e instanceof DOMException && e.name === 'AbortError')) return;
    put({ phase: e instanceof AppError && e.code === 'AMBIGUOUS' ? 'ambiguous' : 'error', attempt: id, error: message(e), review: previous });
  }
  async function prepare(intent: ReadyIntent, id: number, previous?: Review) {
    const chain = intent.chain === 'ethereum' ? 1 : 42161;
    const account = simulation ? SIM_ACCOUNT : getConnection(config).address;
    if (!simulation && (!account || getConnection(config).chainId !== chain)) { put({ phase: 'connecting', attempt: id, intent }); return; }
    if (!account) return;
    put({ phase: 'quoting', attempt: id, review: previous });
    const signal = freshController();
    const balance = simulation ? SIM_BALANCE : (await readBalances(account, chain)).eth;
    if (!matches(id, account, chain)) return;
    if (previous) checkFreshBalance(intent, BigInt(previous.balance), balance, BigInt(previous.quote.sell));
    let usd: Review['usd'];
    let resolved = intent;
    if (intent.amountType === 'usd') {
      const price = await post<{ price: string; fetchedAt: number }>('/api/price', {}, signal);
      if (!Number.isFinite(price.fetchedAt) || Date.now() - price.fetchedAt > 30000 || price.fetchedAt > Date.now() + 5000) throw new AppError('PRICE', 'Price expired. Try again.');
      resolved = { ...intent, amountType: 'exact', amount: eth(usdToWei(intent.amount, price.price)) };
      usd = { amount: intent.amount, ...price };
    }
    const amount = previous && intent.amountType !== 'usd' ? BigInt(previous.quote.sell) : amountFor(resolved, balance);
    const quote = simulation ? (await pause(650), simulatedQuote(amount, chain === 1, intent.chain === 'base')) : (await post<{ quote: Quote }>('/api/quote', { account, sellAmountBaseUnits: amount.toString(), ...(chain === 1 ? {action: 'bridge'} : intent.chain === 'base' ? {action: 'base'} : {}) }, signal)).quote;
    if (!matches(id, account, chain)) return;
    if (usd) quote.validUntil = Math.min(quote.validUntil, usd.fetchedAt + 30000);
    put({ phase: 'review', attempt: id, review: { quote, intent, balance: balance.toString(), usd } });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current || disabled || !text.trim()) return;
    busy.current = true; const id = ++attempt.current; const signal = freshController();
    setSentence(text.trim()); put({ phase: 'interpreting', attempt: id });
    try {
      const data = await post<{ intent: unknown }>('/api/intent', { text: text.trim() }, signal);
      if (id !== attempt.current) return;
      await prepare(validateIntent(data.intent), id);
    } catch (e) { showError(e, id); } finally { busy.current = false; }
  }
  async function refresh(previous: Review) {
    if (busy.current) return; busy.current = true;
    try { await prepare(previous.intent, attempt.current, previous); } catch (e) { showError(e, attempt.current, previous); } finally { busy.current = false; }
  }
  function edit() {
    if (locked || busy.current) return;
    controller.current?.abort(); attempt.current++; focusRequested.current = true; put({ phase: 'idle', attempt: attempt.current });
  }
  async function track(record: Pending, id: number, previous?: Review) {
    let latest = record;
    if (currentState.current.phase !== 'unknownPending') put({ phase: 'swapPending', attempt: id, pending: record, review: previous });
    try {
      const receipt = record.sourceConfirmed ? {transactionHash: record.hash} : await monitor(record, next => { latest = next; savePending(next); put({ phase: 'swapPending', attempt: id, pending: next, review: previous }); });
      if (record.chain === 1 || record.destination === 8453) {
        latest = { ...latest, sourceConfirmed: true }; savePending(latest);
        void queryClient.invalidateQueries({ queryKey: ['wallet-balances', record.account.toLowerCase()] });
        const result = await bridgeStatus(latest);
        if (!result.complete || !result.destinationHash) {
          put({ phase: 'unknownPending', attempt: id, pending: latest, review: previous, error: result.message }); return;
        }
        clearPending();
        put({ phase: 'confirmed', attempt: id, sell: record.sell, expected: record.expected, bridge: true, destination: record.destination, hash: result.destinationHash, sourceHash: latest.hash, simulated: false });
      } else { clearPending();
      put({ phase: 'confirmed', attempt: id, sell: record.sell, expected: record.expected, hash: receipt.transactionHash, simulated: false }); }
      void queryClient.invalidateQueries({ queryKey: ['wallet-balances', record.account.toLowerCase()] });
      void queryClient.invalidateQueries({ queryKey: ['wallet-history', record.account.toLowerCase()] });
    } catch (e) {
      if (e instanceof AppError && (e.code === 'REVERTED' || e.code === 'REPLACED')) { clearPending(); showError(e, id); }
      else put({ phase: 'unknownPending', attempt: id, pending: latest, review: previous, error: 'Still checking this transaction. Don’t submit another swap yet.' });
    }
  }
  async function perform(r: Review) {
    if (busy.current || Date.now() >= r.quote.validUntil) return;
    busy.current = true; const id = attempt.current;
    put({ phase: 'swapSignature', attempt: id, review: r });
    try {
      if (simulation) {
        await simulateStep(r.quote);
        put({ phase: 'swapPending', attempt: id, review: r, simulated: true });
        await pause(1100);
        put({ phase: 'confirmed', attempt: id, sell: r.quote.sell, expected: r.quote.expected, bridge: r.quote.chain === 1 || r.quote.destination === 8453, destination: r.quote.destination, simulated: true });
      } else {
        const wallet = await getWalletClient(config);
        const hash = await sendSwap(r.quote, wallet, r.intent, BigInt(r.balance), () => matches(id, r.quote.account, r.quote.chain));
        const record: Pending = { hash, chain: r.quote.chain, destination: r.quote.destination, minimum: r.quote.minimum, account: r.quote.account, sell: r.quote.sell, expected: r.quote.expected, source: r.quote.sourceName };
        savePending(record); await track(record, id, r);
      }
    } catch (e) { showError(e, id, e instanceof AppError && e.code === 'CANCELLED' ? r : undefined); }
    finally { busy.current = false; }
  }
  useEffect(() => {
    if (!review) return;
    const deadline = review.quote.validUntil;
    const timer = setTimeout(() => setExpiredAt(deadline), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [review]);
  useEffect(() => {
    if (state.phase !== 'unknownPending' || !state.pending || simulation) return;
    // Retry only receipt/delivery reads. Never request another signature or send.
    const timer = setTimeout(() => {
      if (busy.current || currentState.current !== state) return;
      busy.current = true;
      void track(state.pending!, state.attempt, state.review).finally(() => { busy.current = false; });
    }, 10000);
    return () => clearTimeout(timer);
    // Each result schedules the next check; unmount/completion cancels it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, simulation]);
  useEffect(() => {
    if (state.phase === 'idle' && focusRequested.current) { focusRequested.current = false; input.current?.focus(); }
  }, [state.phase, state.attempt]);
  useEffect(() => {
    if (simulation) return;
    const key = `${connection.address || ''}:${connection.chainId || ''}`;
    const prior = previousWallet.current; previousWallet.current = key;
    if (prior !== null && prior !== key && !unresolved(currentState.current) && !['idle', 'connecting', 'confirmed'].includes(currentState.current.phase)) {
      controller.current?.abort(); attempt.current++;
      put({ phase: 'invalidated', attempt: attempt.current, error: 'Your wallet changed. Review a new quote before continuing.' });
    }
  }, [connection.address, connection.chainId, simulation]);
  useEffect(() => {
    if (restored.current || simulation) return; restored.current = true;
    let record: Pending | null = null; try { record = restore(sessionStorage.getItem(STORAGE_KEY)); } catch { /* Storage may be unavailable. */ }
    if (record) { busy.current = true; void track(record, attempt.current).finally(() => { busy.current = false; }); }
    // Restore once. Receipt monitoring never requests a wallet signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation]);
  async function walletAction(action: () => Promise<unknown>) {
    if (busy.current || locked) return; busy.current = true; setWalletError('');
    try { await action(); setWalletMenu(false); }
    catch { setWalletError('Wallet connection was not completed. Use an installed desktop wallet and try again.'); }
    finally { busy.current = false; }
  }
  async function continueIntent(intent: ReadyIntent) {
    if (busy.current) return; busy.current = true;
    try { await prepare(intent, attempt.current); } catch (e) { showError(e, attempt.current); } finally { busy.current = false; }
  }
  async function copy(address: string) { try { await navigator.clipboard.writeText(address); setCopied(true); } catch { setCopied(false); } }
  const baseRoute = review?.quote.destination === 8453 || pending?.destination === 8453 || (state.phase === 'connecting' && state.intent.chain === 'base');
  const isBridge = baseRoute || review?.quote.chain === 1 || pending?.chain === 1 || (state.phase === 'connecting' && state.intent.chain === 'ethereum');
  const sourceName = isBridge && !baseRoute ? 'Ethereum' : 'Arbitrum';
  const targetChain = isBridge && !baseRoute ? 1 : arbitrum.id;
  const outputToken = isBridge && !baseRoute ? 'ETH' : 'USDC';
  const statusText = state.phase === 'interpreting' ? 'Understanding your instruction…' : state.phase === 'quoting' ? 'Getting a quote…' : state.phase === 'swapSignature' ? simulation ? 'Simulating wallet confirmation…' : `Review the ${isBridge ? 'bridge' : 'swap'} in your wallet.` : state.phase === 'swapPending' ? isBridge ? `Waiting for ${sourceName} confirmation…` : 'Waiting for swap confirmation…' : state.phase === 'unknownPending' ? state.error : '';

  const hasReview = !!review || state.phase === 'confirmed';
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to swap</a>
    <header className="header">
      <a className="wordmark" href="/" aria-label="Wallet Agent home">Wallet Agent</a>
      <div className="header-actions"><ChainPicker chainId={simulation ? arbitrum.id : connection.address ? connection.chainId : undefined} disabled={simulation || !connection.address || disabled} onChange={chainId => void walletAction(() => switchChain.mutateAsync({ chainId }))} />
        {simulation ? <span className="demo-wallet">{scripted ? 'Scripted demo' : 'Demo wallet'}</span> : <div className="wallet-wrap">
          <button className="wallet-button" disabled={disabled} onClick={() => setWalletMenu(!walletMenu)} aria-expanded={walletMenu}>{walletBusy ? 'Connecting…' : connection.address ? shortAddress(connection.address) : 'Connect wallet'}</button>
          {walletMenu && <div className="wallet-menu"><p>Choose your desktop wallet</p>{connection.address ? <button onClick={() => void walletAction(() => disconnect.mutateAsync({}))}>Disconnect</button> : connectors.length ? connectors.map(c => <button key={c.uid} onClick={() => void walletAction(() => connect.mutateAsync({ connector: c }))}>{c.name}</button>) : <p>Open this demo with an Ethereum wallet extension.</p>}</div>}
        </div>}
        {!simulation && connection.address && <HeaderPopover key={`${connection.address}:${connection.chainId}`} disabled={disabled}><WalletBalances account={connection.address} chainId={connection.chainId} /></HeaderPopover>}
      </div>
    </header>
    <div className="workspace"><WalletHistory account={simulation ? undefined : connection.address} pending={pending} />
    <main id="main">
      <div className="agent-content">
      <section className="intro"><p className="subtitle">Swap and bridge with one instruction</p></section>
      {walletError && <p className="wallet-error" role="alert">{walletError}</p>}
      <form className="composer" onSubmit={submit} hidden={hasReview}>
        <label htmlFor="instruction">What would you like to do?</label>
        <div className="input-wrap"><textarea ref={input} id="instruction" rows={2} value={text} maxLength={160} disabled={disabled} placeholder={EXAMPLE} onChange={e => { setText(e.target.value); if (state.phase !== 'idle') edit(); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!disabled) e.currentTarget.form?.requestSubmit(); } }} />
          <button className="send-button" type="submit" disabled={disabled || !text.trim()} aria-label="Submit instruction">{reading ? <Spinner /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>}</button>
        </div>
        <div className="composer-meta"><span>{text.length}/160</span></div>
      </form>
      {state.phase === 'idle' && <div className="starter"><span>Try</span><button className="example" onClick={() => { setText(EXAMPLE); input.current?.focus(); }}>{EXAMPLE} <span aria-hidden="true">↗</span></button><button className="example" onClick={() => { setText('Bridge $2 of ETH from Arbitrum to Base then swap to USDC'); input.current?.focus(); }}>Get USDC on Base <span aria-hidden="true">↗</span></button><button className="example" onClick={() => { setText(BRIDGE_EXAMPLE); input.current?.focus(); }}>Bridge ETH to Arbitrum <span aria-hidden="true">↗</span></button></div>}
      {sentence && state.phase !== 'idle' && <p className="sentence">{sentence}</p>}
      <div className="flow" aria-busy={reading}>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusText || (state.phase === 'review' ? 'Quote ready. Review the amounts before continuing.' : state.phase === 'confirmed' ? simulation ? 'Simulation complete.' : state.bridge ? 'Bridge complete.' : 'Swap confirmed.' : '')}</div>
        {reading && !review && <section className="review-card loading-card"><div className="status-line"><Spinner /><p>{statusText}</p></div><div className="skeleton wide" /><div className="skeleton narrow" /><div className="skeleton wide" /></section>}
        {state.phase === 'connecting' && <section className="review-card"><h2>{connection.address ? `Use ${sourceName}` : 'Connect your wallet'}</h2><p className="muted">{connection.address ? `This action uses your ETH on ${sourceName}.` : `Connect your wallet to use your ${sourceName} ETH balance.`}</p>{connection.address && connection.chainId !== targetChain ? <button className="primary" disabled={walletBusy} onClick={() => void walletAction(() => switchChain.mutateAsync({ chainId: targetChain }))}>Switch to {sourceName}</button> : connection.address ? <button className="primary" onClick={() => void continueIntent(state.intent)}>Get quote</button> : <button className="primary" onClick={() => setWalletMenu(true)}>Choose wallet</button>}<button className="text-button" onClick={edit}>Edit instruction</button></section>}
        {review && state.phase !== 'ambiguous' && <section className="review-card">
          <div className="card-top"><h2>Review your {baseRoute ? 'plan' : isBridge ? 'bridge' : 'swap'}</h2><span className="small muted">{simulation ? 'Simulated quote' : 'Via Zerion'}</span></div>
          <div className="review-amounts">
            <div className="token-row"><div><p className="small muted">You pay · {sourceName}</p><p className="amount" title={`${eth(review.quote.sell)} ETH`}>{displayAmount(eth(review.quote.sell))} <span>ETH</span></p><p className="small muted">{review.usd ? `≈ $${review.usd.amount}` : review.intent.amountType === 'percentage' ? `${review.intent.amount}% of your ETH` : 'Gas is additional'}</p></div><span className="token-marker eth-marker" aria-hidden="true">Ξ</span></div>
            <div className="direction" aria-hidden="true">↓</div>
            <div className="token-row"><div><p className="small muted">You receive · {baseRoute ? 'Base' : 'Arbitrum'}</p><p className="amount" title={`${review.quote.expected} ${outputToken}`}>{displayAmount(review.quote.expected)} <span>{outputToken}</span></p><p className="small muted">Estimated · Same wallet</p></div><span className="token-marker" aria-hidden="true">{outputToken === 'ETH' ? 'Ξ' : '$'}</span></div>
          </div>
          <details className="review-details"><summary>Details</summary>
            <dl className="quote-details">
              <div><dt>Exact payment</dt><dd>{eth(review.quote.sell)} ETH</dd></div>
              <div><dt>Balance</dt><dd>{eth(review.balance)} ETH</dd></div>
              <div><dt>Estimated output</dt><dd>{review.quote.expected} {outputToken}</dd></div>
              <div><dt>Minimum received</dt><dd>{review.quote.minimum} {outputToken}</dd></div>
              <div><dt>Slippage</dt><dd>0.5%</dd></div>
              <div><dt>Network fee (est.)</dt><dd>{review.quote.networkFee.label}</dd></div>
              <div><dt>Provider fee</dt><dd>{review.quote.providerFee.label}</dd></div>
              {isBridge && <div><dt>Bridge fee</dt><dd>{!review.quote.bridgeFee || review.quote.bridgeFee.label === 'Unavailable' ? 'Not separately provided' : review.quote.bridgeFee.label}</dd></div>}
              {isBridge && review.quote.estimatedSeconds != null && <div><dt>Estimated delivery</dt><dd>~{review.quote.estimatedSeconds}s</dd></div>}
              <div><dt>Route</dt><dd>{review.quote.sourceName}</dd></div>
            </dl>
            <div className="technical-details">
              {review.usd && <p>Approximately ${review.usd.amount} of ETH at ${Number(review.usd.price).toFixed(2)}/ETH. Gas is additional; refreshing recalculates the ETH amount.</p>}
              {baseRoute && <p>The quoted route bridges from Arbitrum and converts to USDC on Base.</p>}
              {(!isBridge || baseRoute) && <p><strong>USDC contract</strong><span>{baseRoute ? BASE_USDC : USDC}</span></p>}
              <p><strong>Recipient{simulation ? ' (simulated)' : ''}</strong><span>{review.quote.account}</span><button className="copy-button" onClick={() => void copy(review.quote.account)}>{copied ? 'Copied' : 'Copy address'}</button></p>
              <p>{review.quote.providerFee.inclusion}</p><p>{review.quote.networkFee.inclusion}</p><p>ETH pays for the action and source-network gas. Review the final fee in your wallet.</p>
            </div>
          </details>
          {['review', 'quoting', 'error'].includes(state.phase) ? <>
            {state.phase === 'error' && <p className="error-text" role="alert">{state.error}</p>}
            {!simulation && !review.quote.executable && <p className="error-text" role="alert">{review.quote.blockedReason}</p>}
            <button className="primary" disabled={reading || (!simulation && !review.quote.executable && !expired && state.phase !== 'error')} onClick={() => void (expired || state.phase === 'error' ? refresh(review) : perform(review))}>{reading ? 'Refreshing quote…' : expired || state.phase === 'error' ? 'Refresh quote' : simulation ? isBridge ? 'Simulate bridge' : 'Simulate swap' : baseRoute ? 'Confirm plan' : isBridge ? 'Confirm bridge' : 'Confirm swap'}</button>
            <div className="card-bottom"><button className="text-button" disabled={reading} onClick={edit}>Edit</button><span className="small muted">{reading ? 'Updating amounts' : expired ? 'Quote expired' : 'Confirm in your wallet'}</span></div>
          </> : <div className="pending-status"><div className="status-line"><Spinner /><p>{statusText}</p></div>{pending && <><Explorer hash={pending.hash} chain={pending.chain} />{(pending.chain === 1 || pending.destination === 8453) && <a href={`https://scan.li.fi/tx/${pending.hash}`} target="_blank" rel="noreferrer">Track bridge ↗</a>}</>}{state.phase === 'unknownPending' && <p className="small muted">Checking automatically…</p>}</div>}
        </section>}
        {pending && !review && <section className="review-card"><h2>Checking your transaction</h2><p>{statusText}</p><p className="small muted">Original account: {shortAddress(pending.account)} · {pending.chain === 1 ? 'Ethereum' : 'Arbitrum'}</p><Explorer hash={pending.hash} chain={pending.chain} />{(pending.chain === 1 || pending.destination === 8453) && <a href={`https://scan.li.fi/tx/${pending.hash}`} target="_blank" rel="noreferrer">Track bridge ↗</a>}{state.phase === 'unknownPending' && <p className="small muted">Checking automatically…</p>}</section>}
        {((state.phase === 'error' && !review) || state.phase === 'invalidated' || state.phase === 'ambiguous') && <section className="review-card error-card" role="alert"><span className="error-symbol" aria-hidden="true">!</span><h2>{state.phase === 'ambiguous' ? 'Check your wallet activity' : state.phase === 'invalidated' ? 'Let’s review that again' : 'Couldn’t continue'}</h2><p>{state.error}</p>{state.phase === 'ambiguous' ? <button className="primary" onClick={() => { attempt.current++; put({ phase: 'idle', attempt: attempt.current }); }}>I checked: nothing is pending</button> : state.review ? <button className="primary" onClick={() => void refresh(state.review!)}>Review a fresh quote</button> : <button className="primary" onClick={edit}>Edit and try again</button>}</section>}
        {state.phase === 'confirmed' && <section className="review-card success-card"><div className="success-symbol" aria-hidden="true">✓</div><h2>{state.simulated ? 'Simulation complete' : state.destination === 8453 ? 'Plan complete' : state.bridge ? 'Bridge complete' : 'Swap confirmed'}</h2><p className="success-amount" title={`${eth(state.sell)} ETH`}>{displayAmount(eth(state.sell))} ETH <span aria-hidden="true">→</span> {state.destination === 8453 ? 'USDC on Base' : state.bridge ? 'ETH on Arbitrum' : 'USDC'}</p><p className="muted" title={state.expected}>Quoted output: {displayAmount(state.expected)} {state.bridge && state.destination !== 8453 ? 'ETH' : 'USDC'}</p>{state.simulated ? <p className="small muted">No funds moved. No wallet signature was requested.</p> : state.hash && <Explorer hash={state.hash} chain={state.destination ?? 42161} />}<button className="primary" onClick={() => { setText(''); setSentence(''); edit(); }}>Start another {state.bridge ? 'action' : 'swap'}</button></section>}
      </div>
      </div>
    </main></div>
    <footer><span>Powered by</span><a href="https://zerion.io/" target="_blank" rel="noreferrer" aria-label="Visit Zerion"><img src="/brand/zerion-lockup.svg" alt="Zerion" width="82" height="20" /></a></footer>
  </div>;
}
