import type { Quote } from './quote';
import type { ReadyIntent } from './intent';
import type { Pending } from './transactions';
export type Review = { quote: Quote; intent: ReadyIntent; balance: string; usd?: { amount: string; price: string; fetchedAt: number } };
export type State =
  | { phase: 'idle'; attempt: number }
  | { phase: 'interpreting' | 'quoting'; attempt: number; review?: Review }
  | { phase: 'connecting'; attempt: number; intent: ReadyIntent }
  | { phase: 'review' | 'swapSignature'; attempt: number; review: Review }
  | { phase: 'swapPending' | 'unknownPending'; attempt: number; review?: Review; pending?: Pending; simulated?: boolean; error?: string }
  | { phase: 'confirmed'; attempt: number; sell: string; expected: string; hash?: string; sourceHash?: string; bridge?: boolean; destination?: 8453; simulated: boolean }
  | { phase: 'error' | 'invalidated' | 'ambiguous'; attempt: number; error: string; review?: Review };
export type Event = { type: 'replace'; state: State } | { type: 'reset' } | { type: 'invalidate' };
export function unresolved(s: State) { return ['swapSignature', 'swapPending', 'unknownPending', 'ambiguous'].includes(s.phase); }
export function reducer(s: State, event: Event): State {
  if (event.type === 'reset') return unresolved(s) ? s : { phase: 'idle', attempt: s.attempt + 1 };
  if (event.type === 'invalidate') return unresolved(s) ? s : { phase: 'invalidated', attempt: s.attempt + 1, error: 'Your wallet changed. Review a new quote before continuing.' };
  if (event.state.attempt < s.attempt) return s;
  return event.state;
}
