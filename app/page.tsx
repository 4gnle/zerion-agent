import { Providers } from '@/components/providers';
import { SwapScreen } from '@/components/swap-screen';
import { appMode } from '@/lib/http.server';
export const dynamic = 'force-dynamic';
export default function Home() { return <Providers><SwapScreen mode={appMode()} scripted={!process.env.OPENAI_API_KEY} /></Providers>; }
