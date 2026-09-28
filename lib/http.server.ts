import { z } from 'zod';
import { AppError } from './errors';
const gates = new Map<string, { count: number; since: number; active: boolean }>();
export function appMode() { const mode = process.env.APP_MODE || 'simulation'; if (mode !== 'live' && mode !== 'simulation') throw new AppError('CONFIG', 'APP_MODE must be live or simulation.', 503); return mode; }
export async function handle<T>(request: Request, operation: 'intent' | 'quote', schema: z.ZodType<T>, fn: (body: T) => Promise<unknown>) {
  let release: (() => void) | undefined;
  try {
    const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
    if (request.headers.get('origin') !== origin || new URL(request.url).origin !== origin) throw new AppError('ORIGIN', 'Request origin is not allowed.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AppError('CONTENT_TYPE', 'Expected JSON.', 415);
    // Local-only server; do not trust caller-supplied forwarding/IP headers.
    const now = Date.now(); let gate = gates.get(operation);
    if (!gate) { gate = { count: 0, since: now, active: false }; gates.set(operation, gate); }
    if (gate.active) throw new AppError('BUSY', 'A request is already in progress.', 429);
    if (now - gate.since >= 60000) { gate.count = 0; gate.since = now; }
    if (gate.count >= (operation === 'intent' ? 10 : 20)) throw new AppError('RATE_LIMIT', 'Please wait a minute before trying again.', 429);
    gate.count++; gate.active = true; release = () => { gate.active = false; };
    const reader = request.body?.getReader(); if (!reader) throw new AppError('BODY', 'Expected a request body.');
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2048) { await reader.cancel(); throw new AppError('SIZE', 'Request is too large.', 413); } chunks.push(value); }
    let raw: unknown;
    try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('JSON', 'Invalid JSON.'); }
    const body = schema.safeParse(raw); if (!body.success) throw new AppError('BODY', 'Invalid request.');
    return Response.json(await fn(body.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const error = e instanceof AppError ? e : new AppError('UNAVAILABLE', 'This service is temporarily unavailable. Try again.', 503);
    return Response.json({ code: error.code, error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  } finally { release?.(); }
}
