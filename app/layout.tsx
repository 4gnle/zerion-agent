import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Half — Swap in a sentence', description: 'A focused USDC to ETH swap prototype on Base.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
