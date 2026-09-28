'use client';
import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { useConfig, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi';
import { getConnection, getWalletClient } from 'wagmi/actions';
import type { Address } from 'viem';
import { base, EXAMPLE, USDC, type Mode } from '@/lib/config';
import { amountFor, checkFreshBalance, usdc } from '@/lib/amounts';
import { validateIntent, type ReadyIntent } from '@/lib/intent';
import { AppError, message } from '@/lib/errors';
import { reducer, unresolved, type Review, type State } from '@/lib/flow';
import { readBalances } from '@/lib/rpc';
import { afterApproval, monitor, requiresApproval, sendStep, type Pending } from '@/lib/transactions';
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
const displayEth = (value: string) => { const [whole, fraction = ''] = value.split('.'); return `${whole}.${fraction.slice(0, 6).padEnd(6, '0')}`; };
function Spinner() { return <span className="spinner" aria-hidden="true" />; }
function Explorer({ hash }: { hash: string }) { return <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer">View on Basescan <span aria-hidden="true">↗</span></a>; }

export function SwapScreen({ mode, scripted }: { mode: Mode; scripted: boolean }) {
  const simulation = mode === 'simulation';
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
  const review = 'review' in state ? state.review : undefined;
  const pending = 'pending' in state ? state.pending : undefined;
  const locked = unresolved(state); const reading = state.phase === 'interpreting' || state.phase === 'quoting';
  const walletBusy = connect.isPending || switchChain.isPending;
  const disabled = locked || reading || walletBusy;
  const expired = !!review && now >= review.quote.validUntil;
  const put = (next: State) => dispatch({ type: 'replace', state: next });
  const freshController = () => { controller.current?.abort(); controller.current = new AbortController(); return controller.current.signal; };
  function matches(id: number, account?: Address) {
    const live = getConnection(config);
    return id === attempt.current && (simulation || !account || (live.address?.toLowerCase() === account.toLowerCase() && live.chainId === base.id));
  }
  function showError(e: unknown, id: number, previous?: Review) {
    if (id !== attempt.current || (e instanceof DOMException && e.name === 'AbortError')) return;
    put({ phase: e instanceof AppError && e.code === 'AMBIGUOUS' ? 'ambiguous' : 'error', attempt: id, error: message(e), review: previous });
  }
  async function prepare(intent: ReadyIntent, id: number, previous?: Review) {
    const account = simulation ? SIM_ACCOUNT : getConnection(config).address;
    if (!simulation && (!account || getConnection(config).chainId !== base.id)) { put({ phase: 'connecting', attempt: id, intent }); return; }
    if (!account) return;
    put({ phase: 'quoting', attempt: id });
    const signal = freshController();
    const balance = simulation ? SIM_BALANCE : (await readBalances(account)).usdc;
    if (!matches(id, account)) return;
    if (previous) checkFreshBalance(intent, BigInt(previous.balance), balance, BigInt(previous.quote.sell));
    const amount = previous ? BigInt(previous.quote.sell) : amountFor(intent, balance);
    const quote = simulation ? (await pause(650), simulatedQuote(amount)) : (await post<{ quote: Quote }>('/api/quote', { account, sellAmountBaseUnits: amount.toString() }, signal)).quote;
    if (!matches(id, account)) return;
    if (previous?.approved) afterApproval(previous.quote, quote);
    const needsApproval = simulation ? !previous?.approved : quote.executable && await requiresApproval(quote);
    if (previous?.approved && needsApproval) throw new AppError('ALLOWANCE', 'The allowance is still insufficient. Start a new review; no additional approval was requested.');
    if (!matches(id, account)) return;
    put({ phase: 'review', attempt: id, review: { quote, intent, balance: balance.toString(), needsApproval, approved: !!previous?.approved } });
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
    controller.current?.abort(); attempt.current++; put({ phase: 'idle', attempt: attempt.current }); input.current?.focus();
  }
  async function track(record: Pending, id: number, previous?: Review) {
    let latest = record;
    put({ phase: record.stage === 'approval' ? 'approvalPending' : 'swapPending', attempt: id, pending: record, review: previous });
    try {
      const receipt = await monitor(record, next => { latest = next; savePending(next); put({ phase: next.stage === 'approval' ? 'approvalPending' : 'swapPending', attempt: id, pending: next, review: previous }); });
      clearPending();
      if (record.stage === 'swap') {
        put({ phase: 'confirmed', attempt: id, sell: record.sell, expected: record.expected, hash: receipt.transactionHash, simulated: false });
        void readBalances(record.account).catch(() => undefined);
      } else if (previous && matches(id, record.account)) {
        await prepare(previous.intent, id, { ...previous, approved: true });
      } else put({ phase: 'error', attempt: id, error: 'USDC allowance is set. The swap was not submitted. Start a new review to continue.' });
    } catch (e) {
      if (e instanceof AppError && (e.code === 'REVERTED' || e.code === 'REPLACED')) { clearPending(); showError(e, id); }
      else if (e instanceof AppError) showError(e, id);
      else put({ phase: 'unknownPending', attempt: id, pending: latest, review: previous, error: 'Still checking this transaction. Don’t submit another swap yet.' });
    }
  }
  async function perform(r: Review) {
    if (busy.current || expired) return;
    busy.current = true; const id = attempt.current;
    const stage = r.needsApproval ? 'approval' : 'swap';
    put({ phase: stage === 'approval' ? 'approvalSignature' : 'swapSignature', attempt: id, review: r });
    try {
      if (simulation) {
        await simulateStep(r.quote);
        put({ phase: stage === 'approval' ? 'approvalPending' : 'swapPending', attempt: id, review: r, simulated: true });
        await pause(1100);
        if (stage === 'approval') await prepare(r.intent, id, { ...r, approved: true });
        else put({ phase: 'confirmed', attempt: id, sell: r.quote.sell, expected: r.quote.expected, simulated: true });
      } else {
        const wallet = await getWalletClient(config);
        const hash = await sendStep(r.quote, stage, wallet, r.intent, BigInt(r.balance), () => matches(id, r.quote.account));
        const record: Pending = { hash, chain: 8453, account: r.quote.account, stage, sell: r.quote.sell, expected: r.quote.expected, source: r.quote.sourceName, spender: r.quote.spender };
        savePending(record);
        await track(record, id, r);
      }
    } catch (e) {
      showError(e, id, e instanceof AppError && e.code === 'CANCELLED' ? r : undefined);
    } finally { busy.current = false; }
  }
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (simulation) return;
    const key = `${connection.address || ''}:${connection.chainId || ''}`;
    const prior = previousWallet.current; previousWallet.current = key;
    if (prior !== null && prior !== key && !unresolved(currentState.current) && currentState.current.phase !== 'connecting' && currentState.current.phase !== 'confirmed') {
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
  const statusText = state.phase === 'interpreting' ? 'Understanding your swap…' : state.phase === 'quoting' ? 'Getting a quote…' : state.phase === 'approvalSignature' ? simulation ? 'Simulating your approval…' : 'Review the USDC allowance in your wallet.' : state.phase === 'swapSignature' ? simulation ? 'Simulating wallet confirmation…' : 'Review the swap in your wallet.' : state.phase === 'approvalPending' ? 'Waiting for USDC approval…' : state.phase === 'swapPending' ? 'Waiting for swap confirmation…' : state.phase === 'unknownPending' ? state.error : '';

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to swap</a>
    <header className="header">
      <a className="wordmark" href="/" aria-label="Half home">half<span className="wordmark-dot">.</span></a>
      <div className="header-actions"><span className="network"><span className="base-mark" aria-hidden="true" />Base</span>
        {simulation ? <span className="demo-wallet">Demo wallet</span> : <div className="wallet-wrap">
          <button className="wallet-button" disabled={disabled} onClick={() => setWalletMenu(!walletMenu)} aria-expanded={walletMenu}>{walletBusy ? 'Connecting…' : connection.address ? shortAddress(connection.address) : 'Connect wallet'}</button>
          {walletMenu && <div className="wallet-menu"><p>Choose your desktop wallet</p>{connection.address ? <button onClick={() => void walletAction(() => disconnect.mutateAsync({}))}>Disconnect</button> : connectors.length ? connectors.map(c => <button key={c.uid} onClick={() => void walletAction(() => connect.mutateAsync({ connector: c }))}>{c.name}</button>) : <p>Open this demo with an Ethereum wallet extension.</p>}</div>}
        </div>}
      </div>
    </header>
    <main id="main">
      <div className="mode-note">{simulation ? <><span className="status-dot" />{scripted ? 'Scripted simulation' : 'Simulation'} · No real funds or wallet signatures</> : <><span className="status-dot live" />Live · You review and sign in your wallet</>}</div>
      <section className="intro"><p className="eyebrow">A simpler way to swap</p><h1>Swap in a sentence</h1><p className="subtitle">USDC <span aria-hidden="true">→</span> ETH · Base</p></section>
      {walletError && <p className="wallet-error" role="alert">{walletError}</p>}
      <form className="composer" onSubmit={submit}>
        <label htmlFor="instruction">What would you like to swap?</label>
        <div className="input-wrap"><textarea ref={input} id="instruction" rows={2} value={text} maxLength={160} disabled={disabled} placeholder={EXAMPLE} onChange={e => { setText(e.target.value); if (state.phase !== 'idle') edit(); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!disabled) e.currentTarget.form?.requestSubmit(); } }} aria-describedby="input-hint" />
          <button className="send-button" type="submit" disabled={disabled || !text.trim()} aria-label="Review swap">{reading ? <Spinner /> : <span aria-hidden="true">↑</span>}</button>
        </div>
        <div className="composer-meta"><p id="input-hint">Half, a whole percentage, or a USDC amount.</p><span>{text.length}/160</span></div>
      </form>
      {state.phase === 'idle' && <div className="starter"><span>Try</span><button className="example" onClick={() => { setText(EXAMPLE); input.current?.focus(); }}>{EXAMPLE} <span aria-hidden="true">↗</span></button></div>}
      {sentence && state.phase !== 'idle' && <p className="sentence">{sentence}</p>}
      <div className="flow" aria-busy={reading}>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusText || (state.phase === 'review' ? 'Quote ready. Review the amounts before continuing.' : state.phase === 'confirmed' ? simulation ? 'Simulation complete.' : 'Swap confirmed.' : '')}</div>
        {reading && <section className="review-card loading-card"><div className="status-line"><Spinner /><p>{statusText}</p></div><div className="skeleton wide" /><div className="skeleton narrow" /><div className="skeleton wide" /><p className="muted small">{state.phase === 'interpreting' ? 'One instruction. You stay in control.' : simulation ? 'Preparing an illustrative quote.' : 'Checking the route and your Base balance.'}</p></section>}
        {state.phase === 'connecting' && <section className="review-card"><h2>{connection.address ? 'Switch to Base' : 'Connect your wallet'}</h2><p className="muted">{connection.address ? 'This swap uses USDC and ETH on Base.' : 'Connect your wallet to use your Base balance. Your instruction is ready.'}</p>{connection.address && connection.chainId !== base.id ? <button className="primary" disabled={walletBusy} onClick={() => void walletAction(() => switchChain.mutateAsync({ chainId: base.id }))}>Switch to Base</button> : connection.address ? <button className="primary" onClick={() => void continueIntent(state.intent)}>Get quote</button> : <button className="primary" onClick={() => setWalletMenu(true)}>Choose wallet</button>}<button className="text-button" onClick={edit}>Edit instruction</button></section>}
        {review && !['error','ambiguous'].includes(state.phase) && <section className="review-card">
          <div className="card-top"><h2>Review your swap</h2><span className="small muted">{simulation ? 'Simulated quote' : 'Via Zerion'}</span></div>
          <div className="token-row"><div><p className="small muted">You pay</p><p className="amount">{usdc(review.quote.sell)} <span>USDC</span></p><p className="small muted">{review.intent.amountType === 'percentage' ? `${review.intent.amount}% of your Base USDC` : `Balance: ${usdc(review.balance)} USDC`}</p></div><span className="token-marker" aria-hidden="true">$</span></div>
          <div className="direction" aria-hidden="true">↓</div>
          <div className="token-row"><div><p className="small muted">You receive <span>(estimated)</span></p><p className="amount" title={`${review.quote.expected} ETH`}>{displayEth(review.quote.expected)} <span>ETH</span></p><p className="small muted">In the same wallet, on Base</p></div><span className="token-marker eth-marker" aria-hidden="true">Ξ</span></div>
          <dl className="quote-details"><div><dt>Minimum received</dt><dd>{review.quote.minimum} ETH</dd></div><div><dt>Slippage</dt><dd>0.5%</dd></div><div><dt>Network fee <span className="muted">(est.)</span></dt><dd>{review.quote.networkFee.label}</dd></div><div><dt>Provider fee</dt><dd>{review.quote.providerFee.label}</dd></div><div><dt>Route</dt><dd>{review.quote.sourceName}</dd></div></dl>
          <details><summary>Details</summary><div className="technical-details"><p><strong>USDC contract</strong><span>{USDC}</span></p><p><strong>Recipient{simulation ? ' (simulated)' : ''}</strong><span>{review.quote.account}</span><button className="copy-button" onClick={() => void copy(review.quote.account)}>{copied ? 'Copied' : 'Copy address'}</button></p>{review.quote.spender && <p><strong>Allowance spender</strong><span>{review.quote.spender}</span></p>}<p>{review.quote.providerFee.inclusion}</p><p>{review.quote.networkFee.inclusion}</p><p>Base fees include execution and L1-related costs. The total for both steps is not guaranteed; review the final estimate in your wallet.</p></div></details>
          <ol className="steps" aria-label="Swap progress">{(review.needsApproval || review.approved) && <li className={review.approved ? 'complete' : 'active'}>{review.approved ? '✓' : '1'} Allow USDC</li>}<li className={!review.needsApproval ? 'active' : ''}>{review.needsApproval || review.approved ? '2' : '1'} Confirm swap</li><li>Confirmed</li></ol>
          {state.phase === 'review' ? <>
            <p className="action-hint">{review.approved ? 'USDC allowance is set. Review this refreshed quote before confirming.' : review.needsApproval ? 'First allow this amount of USDC, then confirm the swap.' : 'Review the amounts, then confirm the swap.'}</p>
            {!simulation && !review.quote.executable && <p className="error-text" role="alert">{review.quote.blockedReason}</p>}
            <button className="primary" disabled={!simulation && !review.quote.executable && !expired} onClick={() => void (expired ? refresh(review) : perform(review))}>{expired ? 'Refresh quote' : review.needsApproval ? simulation ? 'Simulate USDC approval' : `Allow ${usdc(review.quote.sell)} USDC` : simulation ? 'Simulate swap' : 'Confirm swap'}</button>
            <div className="card-bottom"><button className="text-button" onClick={edit}>Edit</button><span className="small muted">{expired ? 'Quote expired' : `Quote expires in ${Math.max(0, Math.ceil((review.quote.validUntil - now) / 1000))}s`}</span></div>
          </> : <div className="pending-status"><div className="status-line"><Spinner /><p>{statusText}</p></div>{pending && <Explorer hash={pending.hash} />}{state.phase === 'unknownPending' && <button className="primary" onClick={() => { if (pending && !busy.current) { busy.current = true; void track(pending, attempt.current, review).finally(() => { busy.current = false; }); } }}>Check status</button>}</div>}
        </section>}
        {pending && !review && <section className="review-card"><h2>Checking your transaction</h2><p>{statusText}</p><p className="small muted">Original account: {shortAddress(pending.account)} · Base</p><Explorer hash={pending.hash} />{state.phase === 'unknownPending' && <button className="primary" onClick={() => { if (!busy.current) { busy.current = true; void track(pending, attempt.current).finally(() => { busy.current = false; }); } }}>Check status</button>}</section>}
        {(state.phase === 'error' || state.phase === 'invalidated' || state.phase === 'ambiguous') && <section className="review-card error-card" role="alert"><span className="error-symbol" aria-hidden="true">!</span><h2>{state.phase === 'ambiguous' ? 'Check your wallet activity' : state.phase === 'invalidated' ? 'Let’s review that again' : 'Couldn’t continue'}</h2><p>{state.error}</p>{state.review?.approved && <p>USDC allowance is set. The swap was not submitted.</p>}{state.phase === 'ambiguous' ? <button className="primary" onClick={() => { attempt.current++; put({ phase: 'idle', attempt: attempt.current }); }}>I checked: nothing is pending</button> : state.review ? <button className="primary" onClick={() => void refresh(state.review!)}>Review a fresh quote</button> : <button className="primary" onClick={edit}>Edit and try again</button>}</section>}
        {state.phase === 'confirmed' && <section className="review-card success-card"><div className="success-symbol" aria-hidden="true">✓</div><p className="eyebrow">{state.simulated ? 'Rehearsal complete' : 'Included on Base'}</p><h2>{state.simulated ? 'Simulation complete' : 'Swap confirmed'}</h2><p className="success-amount">{usdc(state.sell)} USDC <span aria-hidden="true">→</span> ETH</p><p className="muted">Quoted output: {displayEth(state.expected)} ETH</p>{state.simulated ? <p className="small muted">No funds moved. No wallet signature was requested.</p> : state.hash && <Explorer hash={state.hash} />}<button className="primary" onClick={() => { setText(''); setSentence(''); edit(); }}>Start another swap</button></section>}
      </div>
      <p className="scope-note">USDC → ETH only · Same wallet · Up to 10 USDC per swap</p>
    </main>
    <footer><span>Independent prototype · {simulation ? 'Simulated data' : 'Quotes via Zerion'}</span><a href="https://zerion.io/" target="_blank" rel="noreferrer" aria-label="Visit Zerion"><img src="/brand/zerion-lockup.svg" alt="Zerion" width="82" height="20" /></a></footer>
  </div>;
}
