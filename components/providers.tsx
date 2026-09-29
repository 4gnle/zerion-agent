'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet } from 'viem/chains';
import { arbitrum } from '@/lib/config';
export function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(() => createConfig({ chains: [arbitrum, mainnet], connectors: [injected()], transports: { [mainnet.id]: http(), [arbitrum.id]: http('https://arb1.arbitrum.io/rpc', { retryCount: 0 }) }, ssr: true }));
  const [query] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return <WagmiProvider config={config}><QueryClientProvider client={query}>{children}</QueryClientProvider></WagmiProvider>;
}
