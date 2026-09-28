'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { base } from '@/lib/config';
export function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(() => createConfig({ chains: [base], connectors: [injected()], transports: { [base.id]: http('https://mainnet.base.org', { retryCount: 0 }) }, ssr: true }));
  const [query] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return <WagmiProvider config={config}><QueryClientProvider client={query}>{children}</QueryClientProvider></WagmiProvider>;
}
