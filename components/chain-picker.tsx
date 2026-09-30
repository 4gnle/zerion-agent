'use client';
import { useEffect, useRef } from 'react';
const chains = [{ id: 1, name: 'Ethereum' }, { id: 42161, name: 'Arbitrum' }, { id: 8453, name: 'Base' }];
export function ChainPicker({ chainId, disabled, onChange }: { chainId?: number; disabled: boolean; onChange: (id: number) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node) && ref.current) ref.current.open = false; };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && ref.current?.open) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => { if (disabled && ref.current) ref.current.open = false; }, [disabled]);
  return <details className="chain-picker" ref={ref}><summary aria-label="Connected network" aria-disabled={disabled} onClick={e => { if (disabled) e.preventDefault(); }}>{chains.find(c => c.id === chainId)?.name ?? (chainId ? 'Choose network' : 'Not connected')}<span aria-hidden="true">⌄</span></summary><div className="chain-options" aria-label="Choose network">{chains.map(c => <button key={c.id} type="button" aria-pressed={chainId === c.id} disabled={disabled} onClick={() => { if (ref.current) ref.current.open = false; onChange(c.id); }}>{c.name}<span aria-hidden="true">{chainId === c.id ? '✓' : ''}</span></button>)}</div></details>;
}
