import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';
import fixtures from '../fixtures/intent-cases.json';
import { validateIntent, guardText, type ReadyIntent } from '../lib/intent';
import { amountFor, checkFreshBalance, exactAmount } from '../lib/amounts';
import { normalizeQuote, assertSignable } from '../lib/quote';
import { KYBER_ROUTER } from '../lib/quote';
import { reducer, type State } from '../lib/flow';
import { restore } from '../lib/recovery';
import { simulatedQuote, simulateStep } from '../lib/simulation';

const account: Address = '0x1111111111111111111111111111111111111111';
const router: Address = '0x2222222222222222222222222222222222222222';
const ready = validateIntent(fixtures.cases[0].expected);
export function raw() { return { id: 'quote-1', attributes: { liquidity_source: { id: 'kyber', name: 'KyberSwap' }, input_amount: { quantity: '0.001' }, output_amount: { quantity: '2.7' }, minimum_output_amount: { quantity: '2.6865' }, slippage_percent: 0.5,
  transaction_swap: { evm: { from: account, to: KYBER_ROUTER, chain_id: '0xa4b1', value: '0x38d7ea4c68000', data: '0xe21fd0e9', type: '0x2' } },
}, relationships: { input_chain: { data: { id: 'arbitrum' } }, output_chain: { data: { id: 'arbitrum' } }, input_fungible: { data: { id: 'eth' } }, output_fungible: { data: { id: 'usdc' } } } }; }
const quote = () => normalizeQuote(raw(), account, 1000000000000000n, { sell: 'eth', buy: 'usdc' }, 'kyber');
describe('intent fixtures and scope', () => {
  for (const c of fixtures.cases) it(c.text, () => {
    const mocked = { sellToken: null, buyToken: null, chain: null, amountType: null, amount: null, recipient: null, ...c.expected };
    if (c.expected.status === 'ready') expect(validateIntent(mocked).status).toBe('ready');
    else expect(() => validateIntent(mocked)).toThrow();
  });
  it.each([{ buyToken: 'other' }, { chain: 'other' }, { recipient: 'other' }, { injected: true }, { amount: '25.5' }, { amount: '0' }])('rejects ready result outside scope %o', change => expect(() => validateIntent({ ...ready, ...change })).toThrow());
  it.each(['swap 25% or 50% USDC to ETH', 'swap 1 USDC to ETH for alice.eth', '', 'a'.repeat(161)])('guards text %s', text => expect(() => guardText(text)).toThrow());
});
describe('BigInt amounts', () => {
  it('floors percentages', () => { expect(amountFor(ready,10000001n)).toBe(5000000n); expect(amountFor({ ...ready, amount: '25' },10000001n)).toBe(2500000n); expect(() => amountFor(ready,1n)).toThrow(); });
  it('preserves exact precision', () => expect(exactAmount('0.000000000000000001')).toBe(1n));
  it.each(['0.0000000000000000001','1e3','-1','0','1,000','01'])('rejects %s', value => expect(() => exactAmount(value)).toThrow());
  it('checks cap, funding and gas reserve without clamping', () => { const i: ReadyIntent = { ...ready, amountType: 'exact', amount: '0.002' }; expect(amountFor(i,3000000000000000n)).toBe(2000000000000000n); expect(() => amountFor({ ...i, amount: '0.003' },4000000000000000n)).toThrow(); expect(() => amountFor(i,1n)).toThrow(); expect(() => amountFor({...ready,amount:'100'},100n)).toThrow(); });
  it('invalidates changed percentage balance but retains funded exact amount', () => { expect(() => checkFreshBalance(ready,10n,12n,5n)).toThrow(); expect(() => checkFreshBalance({ ...ready, amountType: 'exact' },10n,12n,5n)).not.toThrow(); });
});
describe('native quote integrity', () => {
  it('uses exactly the native sell value with no approval', () => { const q=quote(); expect(q.swap?.value).toBe(q.sell); expect(q.swap?.to).toBe(KYBER_ROUTER); expect(q.executable).toBe(true); });
  const mutations: [string, (r: ReturnType<typeof raw>) => void][] = [
    ['signer', r => { r.attributes.transaction_swap.evm.from = router; }], ['chain',r => { r.attributes.transaction_swap.evm.chain_id = '0x1'; }],
    ['asset',r => { r.relationships.output_fungible.data.id = 'weth'; }], ['input',r => { r.attributes.input_amount.quantity = '2'; }],
    ['slippage',r => { r.attributes.slippage_percent = 1; }], ['hex',r => { r.attributes.transaction_swap.evm.data = '0xno'; }],
    ['zero minimum',r => { r.attributes.minimum_output_amount.quantity = '0'; }], ['native value',r => { r.attributes.transaction_swap.evm.value = '0x1'; }],
    ['bridge source',r => { r.attributes.liquidity_source.id = 'relay'; }], ['router',r => { r.attributes.transaction_swap.evm.to = router; }], ['destination chain', r => { r.relationships.output_chain.data.id = 'base'; }],
  ];
  it.each(mutations)('rejects wrong %s', (_, mutate) => { const r = raw(); mutate(r); expect(() => normalizeQuote(r,account,1000000000000000n,{sell:'eth',buy:'usdc'},'kyber')).toThrow(); });
  it('rejects approval and bridge payloads', () => { for (const extra of [{transaction_approve:{}},{bridge_fee:{}},{transaction_bridge:{}}]) { const r=raw(); Object.assign(r.attributes,extra); expect(() => normalizeQuote(r,account,1000000000000000n,{sell:'eth',buy:'usdc'},'kyber')).toThrow(); } });
  it('rejects custom fields and signing flows', () => { const r = raw(); Object.assign(r.attributes.transaction_swap.evm,{custom_data:{}}); expect(() => normalizeQuote(r,account,1000000000000000n,{sell:'eth',buy:'usdc'},'kyber')).toThrow(); const s = raw(); Object.assign(s.attributes,{permit:{}}); expect(() => normalizeQuote(s,account,1000000000000000n,{sell:'eth',buy:'usdc'},'kyber')).toThrow(); });
  it('keeps missing payload, provider errors and unpinned route non-executable', () => { const r = raw(); Object.assign(r.attributes,{transaction_swap:null}); expect(normalizeQuote(r,account,1000000000000000n,{sell:'eth',buy:'usdc'},'kyber').executable).toBe(false); Object.assign(r.attributes,{error:{code:'unavailable'}}); expect(normalizeQuote(r,account,1000000000000000n,{sell:'eth',buy:'usdc'},'kyber').executable).toBe(false); expect(normalizeQuote(raw(),account,1000000000000000n,{sell:'eth',buy:'usdc'},'').executable).toBe(false); });
  it('blocks stale and changed-account signing', () => { const q = quote(); expect(() => assertSignable(q,router,42161)).toThrow(); expect(() => assertSignable(q,account,1)).toThrow(); expect(() => assertSignable(q,account,42161,q.validUntil)).toThrow(); });
});
describe('race and recovery boundaries', () => {
  it('discards a late quote after account change', () => { const quoting: State = { phase:'quoting',attempt:1 }; const invalid = reducer(quoting,{type:'invalidate'}); const late = reducer(invalid,{type:'replace',state:{phase:'review',attempt:1,review:{quote:quote(),intent:ready,balance:'10000000'}}}); expect(late.phase).toBe('invalidated'); });
  it('does not erase unresolved transactions on edit or disconnect', () => { const p: State = {phase:'swapPending',attempt:1}; expect(reducer(p,{type:'reset'})).toEqual(p); expect(reducer(p,{type:'invalidate'})).toEqual(p); });
  it('ignores corrupt storage', () => { expect(restore('{')).toBeNull(); expect(restore(JSON.stringify({hash:'0x123',chain:42161}))).toBeNull(); });
  it('never makes simulation signable', async () => { const q = simulatedQuote(1000000n); expect(q.swap).toBeNull(); expect(() => assertSignable(q,account,42161)).toThrow(); await expect(simulateStep({ ...q, swap:quote().swap })).rejects.toThrow(); });
});
