'use client';
import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletHistory } from './wallet-history';
import { HeaderPopover } from './header-popover';
import { WalletBalances } from './wallet-balances';
import { useConfig, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi';
import { getConnection, getWalletClient } from 'wagmi/actions';
import type { Address } from 'viem';
import { arbitrum, BRIDGE_EXAMPLE, EXAMPLE, USDC, type Mode } from '@/lib/config';
import { amountFor, checkFreshBalance, eth } from '@/lib/amounts';
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
function Explorer({ hash, chain = 42161 }: { hash: string; chain?: number }) { return <a href={`https://${chain === 1 ? 'etherscan.io' : 'arbiscan.io'}/tx/${hash}`} target="_blank" rel="noreferrer">View on {chain === 1 ? 'Etherscan' : 'Arbiscan'} <span aria-hidden="true">↗</span></a>; }

export function SwapScreen({ mode, scripted }: { mode: Mode; scripted: boolean }) {
  const simulation = mode === 'simulation';
  const queryClient = useQueryClient();
  const config = useConfig(); const connection = useConnection(); const connectors = useConnectors();
  const connect = useConnect(); const disconnect = useDisconnect(); const switchChain = useSwitchChain();
  const [state, dispatch] = useReducer(reducer, { phase: 'idle', attempt: 0 });
  const currentState = useRef(state); currentState.current = state;
  const [text, setText] = useState(''); const [sentence, setSentence] = useState('');
  const [walletMenu, setWalletMenu] = useState(false); const [walletError, setWalletError] = useState('');
  const [now, setNow] = useState(0); const [copied, setCopied] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null); const busy = useRef(false); const attempt = useRef(0);
  const controller = useRef<AbortController | null>(null); const restored = useRef(false);
  const previousWallet = useRef<string | null>(null);
  const focusRequested = useRef(false);
  const review = 'review' in state ? state.review : undefined;
  const pending = 'pending' in state ? state.pending : undefined;
  const locked = unresolved(state); const reading = state.phase === 'interpreting' || state.phase === 'quoting';
  const walletBusy = connect.isPending || switchChain.isPending;
  const disabled = locked || reading || walletBusy;
  const expired = !!review && now >= review.quote.validUntil;
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
    put({ phase: 'quoting', attempt: id });
    const signal = freshController();
    const balance = simulation ? SIM_BALANCE : (await readBalances(account, chain)).eth;
    if (!matches(id, account, chain)) return;
    if (previous) checkFreshBalance(intent, BigInt(previous.balance), balance, BigInt(previous.quote.sell));
    const amount = previous ? BigInt(previous.quote.sell) : amountFor(intent, balance);
    const quote = simulation ? (await pause(650), simulatedQuote(amount, chain === 1)) : (await post<{ quote: Quote }>('/api/quote', { account, sellAmountBaseUnits: amount.toString(), ...(chain === 1 ? {action: 'bridge'} : {}) }, signal)).quote;
    if (!matches(id, account, chain)) return;
    put({ phase: 'review', attempt: id, review: { quote, intent, balance: balance.toString() } });
    setNow(Date.now());
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
    try { await prepare(previous.intent, attempt.current, previous); } catch (e) { showError(e, attempt.current); } finally { busy.current = false; }
  }
  function edit() {
    if (locked || busy.current) return;
    controller.current?.abort(); attempt.current++; focusRequested.current = true; put({ phase: 'idle', attempt: attempt.current });
  }
  async function track(record: Pending, id: number, previous?: Review) {
    let latest = record;
    put({ phase: 'swapPending', attempt: id, pending: record, review: previous });
    try {
      const receipt = record.sourceConfirmed ? {transactionHash: record.hash} : await monitor(record, next => { latest = next; savePending(next); put({ phase: 'swapPending', attempt: id, pending: next, review: previous }); });
      if (record.chain === 1) {
        latest = { ...latest, sourceConfirmed: true }; savePending(latest);
        void queryClient.invalidateQueries({ queryKey: ['wallet-balances', record.account.toLowerCase()] });
        const result = await bridgeStatus(latest);
        if (!result.complete || !result.destinationHash) {
          put({ phase: 'unknownPending', attempt: id, pending: latest, review: previous, error: result.message }); return;
        }
        clearPending();
        put({ phase: 'confirmed', attempt: id, sell: record.sell, expected: record.expected, bridge: true, hash: result.destinationHash, sourceHash: latest.hash, simulated: false });
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
    if (busy.current || expired) return;
    busy.current = true; const id = attempt.current;
    put({ phase: 'swapSignature', attempt: id, review: r });
    try {
      if (simulation) {
        await simulateStep(r.quote);
        put({ phase: 'swapPending', attempt: id, review: r, simulated: true });
        await pause(1100);
        put({ phase: 'confirmed', attempt: id, sell: r.quote.sell, expected: r.quote.expected, bridge: r.quote.chain === 1, simulated: true });
      } else {
        const wallet = await getWalletClient(config);
        const hash = await sendSwap(r.quote, wallet, r.intent, BigInt(r.balance), () => matches(id, r.quote.account, r.quote.chain));
        const record: Pending = { hash, chain: r.quote.chain, minimum: r.quote.minimum, account: r.quote.account, sell: r.quote.sell, expected: r.quote.expected, source: r.quote.sourceName };
        savePending(record); await track(record, id, r);
      }
    } catch (e) { showError(e, id, e instanceof AppError && e.code === 'CANCELLED' ? r : undefined); }
    finally { busy.current = false; }
  }
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick);
  }, []);
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
  const isBridge = review?.quote.chain === 1 || pending?.chain === 1 || (state.phase === 'connecting' && state.intent.chain === 'ethereum');
  const sourceName = isBridge ? 'Ethereum' : 'Arbitrum';
  const targetChain = isBridge ? 1 : arbitrum.id;
  const outputToken = isBridge ? 'ETH' : 'USDC';
  const statusText = state.phase === 'interpreting' ? 'Understanding your instruction…' : state.phase === 'quoting' ? 'Getting a quote…' : state.phase === 'swapSignature' ? simulation ? 'Simulating wallet confirmation…' : `Review the ${isBridge ? 'bridge' : 'swap'} in your wallet.` : state.phase === 'swapPending' ? isBridge ? 'Waiting for Ethereum confirmation…' : 'Waiting for swap confirmation…' : state.phase === 'unknownPending' ? state.error : '';

  const hasReview = !!review || state.phase === 'confirmed';
  return <div className={`app-shell${hasReview ? ' has-review' : ''}`}>
    <a className="skip-link" href="#main">Skip to swap</a>
    <header className="header">
      <a className="wordmark" href="/" aria-label="Wallet Agent home">Wallet Agent</a>
      <div className="header-actions"><select className="network-select" aria-label="Connected network" value={simulation ? arbitrum.id : connection.address && [1, arbitrum.id].includes(connection.chainId ?? 0) ? connection.chainId : ''} disabled={simulation || !connection.address || disabled} onChange={e => void walletAction(() => switchChain.mutateAsync({ chainId: Number(e.target.value) }))}><option value="" disabled>{connection.address ? 'Choose network' : 'Not connected'}</option><option value={1}>Ethereum</option><option value={arbitrum.id}>Arbitrum</option></select>
        {simulation ? <span className="demo-wallet">{scripted ? 'Scripted demo' : 'Demo wallet'}</span> : <div className="wallet-wrap">
          <button className="wallet-button" disabled={disabled} onClick={() => setWalletMenu(!walletMenu)} aria-expanded={walletMenu}>{walletBusy ? 'Connecting…' : connection.address ? shortAddress(connection.address) : 'Connect wallet'}</button>
          {walletMenu && <div className="wallet-menu"><p>Choose your desktop wallet</p>{connection.address ? <button onClick={() => void walletAction(() => disconnect.mutateAsync({}))}>Disconnect</button> : connectors.length ? connectors.map(c => <button key={c.uid} onClick={() => void walletAction(() => connect.mutateAsync({ connector: c }))}>{c.name}</button>) : <p>Open this demo with an Ethereum wallet extension.</p>}</div>}
        </div>}
        {!simulation && connection.address && <HeaderPopover key={`${connection.address}:${connection.chainId}`} disabled={disabled}><WalletBalances account={connection.address} chainId={connection.chainId} /></HeaderPopover>}
      </div>
    </header>
    <div className="workspace"><WalletHistory account={simulation ? undefined : connection.address} pending={pending} />
    <main id="main">
      {!simulation && <div className="mode-note"><span className="status-dot live" />Live · You review and sign in your wallet</div>}
      <section className="intro"><h1>Wallet Agent</h1><p className="subtitle">Swap on Arbitrum or bridge from Ethereum</p></section>
      {walletError && <p className="wallet-error" role="alert">{walletError}</p>}
      <form className="composer" onSubmit={submit} hidden={hasReview && state.phase !== 'error' && state.phase !== 'ambiguous'}>
        <label htmlFor="instruction">What would you like to do?</label>
        <div className="input-wrap"><textarea ref={input} id="instruction" rows={2} value={text} maxLength={160} disabled={disabled} placeholder={EXAMPLE} onChange={e => { setText(e.target.value); if (state.phase !== 'idle') edit(); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!disabled) e.currentTarget.form?.requestSubmit(); } }} />
          <button className="send-button" type="submit" disabled={disabled || !text.trim()} aria-label="Submit instruction">{reading ? <Spinner /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>}</button>
        </div>
        <div className="composer-meta"><span>{text.length}/160</span></div>
      </form>
      {state.phase === 'idle' && <div className="starter"><span>Try</span><button className="example" onClick={() => { setText(EXAMPLE); input.current?.focus(); }}>{EXAMPLE} <span aria-hidden="true">↗</span></button><button className="example" onClick={() => { setText(BRIDGE_EXAMPLE); input.current?.focus(); }}>Bridge ETH to Arbitrum <span aria-hidden="true">↗</span></button></div>}
      {sentence && state.phase !== 'idle' && <p className="sentence">{sentence}</p>}
      <div className="flow" aria-busy={reading}>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusText || (state.phase === 'review' ? 'Quote ready. Review the amounts before continuing.' : state.phase === 'confirmed' ? simulation ? 'Simulation complete.' : state.bridge ? 'Bridge complete.' : 'Swap confirmed.' : '')}</div>
        {reading && <section className="review-card loading-card"><div className="status-line"><Spinner /><p>{statusText}</p></div><div className="skeleton wide" /><div className="skeleton narrow" /><div className="skeleton wide" /></section>}
        {state.phase === 'connecting' && <section className="review-card"><h2>{connection.address ? `Use ${sourceName}` : 'Connect your wallet'}</h2><p className="muted">{connection.address ? `This action uses your ETH on ${sourceName}.` : `Connect your wallet to use your ${sourceName} ETH balance.`}</p>{connection.address && connection.chainId !== targetChain ? <button className="primary" disabled={walletBusy} onClick={() => void walletAction(() => switchChain.mutateAsync({ chainId: targetChain }))}>Switch to {sourceName}</button> : connection.address ? <button className="primary" onClick={() => void continueIntent(state.intent)}>Get quote</button> : <button className="primary" onClick={() => setWalletMenu(true)}>Choose wallet</button>}<button className="text-button" onClick={edit}>Edit instruction</button></section>}
        {review && !['error','ambiguous'].includes(state.phase) && <section className="review-card">
          <div className="card-top"><h2>Review your {isBridge ? 'bridge' : 'swap'}</h2><span className="small muted">{simulation ? 'Simulated quote' : 'Via Zerion'}</span></div>
          <div className="token-row"><div><p className="small muted">You pay</p><p className={`amount${eth(review.quote.sell).length > 14 ? ' long' : ''}`}>{eth(review.quote.sell)} <span>ETH</span></p><p className="small muted">{review.intent.amountType === 'percentage' ? `${review.intent.amount}% of your ${sourceName} ETH` : `Balance: ${eth(review.balance)} ETH`}</p></div><span className="token-marker eth-marker" aria-hidden="true">Ξ</span></div>
          <div className="direction" aria-hidden="true">↓</div>
          <div className="token-row"><div><p className="small muted">You receive <span>(estimated)</span></p><p className="amount" title={`${review.quote.expected} ${outputToken}`}>{review.quote.expected} <span>{outputToken}</span></p><p className="small muted">In the same wallet, on Arbitrum</p></div><span className="token-marker" aria-hidden="true">{isBridge ? 'Ξ' : '$'}</span></div>
          <dl className="quote-details">{isBridge && <><div><dt>From</dt><dd>Ethereum</dd></div><div><dt>To</dt><dd>Arbitrum</dd></div></>}<div><dt>Minimum received</dt><dd>{review.quote.minimum} {outputToken}</dd></div><div><dt>Slippage</dt><dd>0.5%</dd></div><div><dt>Network fee <span className="muted">(est.)</span></dt><dd>{review.quote.networkFee.label}</dd></div><div><dt>Provider fee</dt><dd>{review.quote.providerFee.label}</dd></div>{isBridge && <div><dt>Bridge fee</dt><dd>{review.quote.bridgeFee?.label ?? 'Unavailable'}</dd></div>}{isBridge && review.quote.estimatedSeconds != null && <div><dt>Estimated delivery</dt><dd>~{review.quote.estimatedSeconds}s</dd></div>}<div><dt>Route</dt><dd>{review.quote.sourceName}</dd></div></dl>
          <details><summary>Details</summary><div className="technical-details">{!isBridge && <p><strong>USDC contract</strong><span>{USDC}</span></p>}<p><strong>Recipient{simulation ? ' (simulated)' : ''}</strong><span>{review.quote.account}</span><button className="copy-button" onClick={() => void copy(review.quote.account)}>{copied ? 'Copied' : 'Copy address'}</button></p><p>{review.quote.providerFee.inclusion}</p><p>{review.quote.networkFee.inclusion}</p><p>ETH pays for the action and source-network gas. The app reserves a gas margin; review the final fee in your wallet.</p></div></details>
          <ol className="steps" aria-label="Swap progress"><li className="active">Confirm {isBridge ? 'on Ethereum' : 'swap'}</li><li>{isBridge ? 'Receive on Arbitrum' : 'Confirmed'}</li></ol>
          {state.phase === 'review' ? <>
            <p className="action-hint">Review the amounts, then confirm in your wallet. No token approval is needed.</p>
            {!simulation && !review.quote.executable && <p className="error-text" role="alert">{review.quote.blockedReason}</p>}
            <button className="primary" disabled={!simulation && !review.quote.executable && !expired} onClick={() => void (expired ? refresh(review) : perform(review))}>{expired ? 'Refresh quote' : simulation ? isBridge ? 'Simulate bridge' : 'Simulate swap' : isBridge ? 'Confirm bridge' : 'Confirm swap'}</button>
            <div className="card-bottom"><button className="text-button" onClick={edit}>Edit</button><span className="small muted">{expired ? 'Quote expired' : `Quote expires in ${Math.max(0, Math.ceil((review.quote.validUntil - now) / 1000))}s`}</span></div>
          </> : <div className="pending-status"><div className="status-line"><Spinner /><p>{statusText}</p></div>{pending && <><Explorer hash={pending.hash} chain={pending.chain} />{pending.chain === 1 && <a href={`https://scan.li.fi/tx/${pending.hash}`} target="_blank" rel="noreferrer">Track bridge ↗</a>}</>}{state.phase === 'unknownPending' && <button className="primary" onClick={() => { if (pending && !busy.current) { busy.current = true; void track(pending, attempt.current, review).finally(() => { busy.current = false; }); } }}>Check status</button>}</div>}
        </section>}
        {pending && !review && <section className="review-card"><h2>Checking your transaction</h2><p>{statusText}</p><p className="small muted">Original account: {shortAddress(pending.account)} · {pending.chain === 1 ? 'Ethereum' : 'Arbitrum'}</p><Explorer hash={pending.hash} chain={pending.chain} />{pending.chain === 1 && <a href={`https://scan.li.fi/tx/${pending.hash}`} target="_blank" rel="noreferrer">Track bridge ↗</a>}{state.phase === 'unknownPending' && <button className="primary" onClick={() => { if (!busy.current) { busy.current = true; void track(pending, attempt.current).finally(() => { busy.current = false; }); } }}>Check status</button>}</section>}
        {(state.phase === 'error' || state.phase === 'invalidated' || state.phase === 'ambiguous') && <section className="review-card error-card" role="alert"><span className="error-symbol" aria-hidden="true">!</span><h2>{state.phase === 'ambiguous' ? 'Check your wallet activity' : state.phase === 'invalidated' ? 'Let’s review that again' : 'Couldn’t continue'}</h2><p>{state.error}</p>{state.phase === 'ambiguous' ? <button className="primary" onClick={() => { attempt.current++; put({ phase: 'idle', attempt: attempt.current }); }}>I checked: nothing is pending</button> : state.review ? <button className="primary" onClick={() => void refresh(state.review!)}>Review a fresh quote</button> : <button className="primary" onClick={edit}>Edit and try again</button>}</section>}
        {state.phase === 'confirmed' && <section className="review-card success-card"><div className="success-symbol" aria-hidden="true">✓</div><h2>{state.simulated ? 'Simulation complete' : state.bridge ? 'Bridge complete' : 'Swap confirmed'}</h2><p className="success-amount">{eth(state.sell)} ETH <span aria-hidden="true">→</span> {state.bridge ? 'ETH on Arbitrum' : 'USDC'}</p><p className="muted">Quoted output: {state.expected} {state.bridge ? 'ETH' : 'USDC'}</p>{state.simulated ? <p className="small muted">No funds moved. No wallet signature was requested.</p> : state.hash && <Explorer hash={state.hash} />}<button className="primary" onClick={() => { setText(''); setSentence(''); edit(); }}>Start another {state.bridge ? 'action' : 'swap'}</button></section>}
      </div>
    </main></div>
    <footer><span>Powered by</span><a href="https://zerion.io/" target="_blank" rel="noreferrer" aria-label="Visit Zerion"><img src="/brand/zerion-lockup.svg" alt="Zerion" width="82" height="20" /></a></footer>
  </div>;
}
