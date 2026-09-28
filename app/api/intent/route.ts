import { z } from 'zod';
import { handle, appMode } from '@/lib/http.server';
import { interpret } from '@/lib/intent.server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return handle(request, 'intent', z.object({ text: z.string().min(1).max(160) }).strict(), async ({ text }) => ({ intent: await interpret(text, appMode()) }));
}
