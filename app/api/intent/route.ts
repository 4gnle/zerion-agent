import { chainSchema } from '@/lib/routes';
import { z } from 'zod';
import { handle, appMode } from '@/lib/http.server';
import { interpret } from '@/lib/intent.server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return handle(request, 'intent', z.object({ text: z.string().min(1).max(160), sourceChain: chainSchema.default(42161) }).strict(), async ({ text, sourceChain }) => ({ intent: await interpret(text, appMode(), sourceChain) }));
}
