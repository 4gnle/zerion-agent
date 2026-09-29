import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Wallet Agent', description: 'An onchain agent prototype with explicit transaction review and wallet signing.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
