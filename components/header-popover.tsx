'use client';
import { useEffect, useRef, type ReactNode } from 'react';
export function HeaderPopover({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && ref.current?.open) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  return <details className="balance-dropdown" ref={ref}><summary aria-disabled={disabled} onClick={e => { if (disabled) e.preventDefault(); }}>Your Balance <span aria-hidden="true">⌄</span></summary><div className="balance-popover">{children}</div></details>;
}
