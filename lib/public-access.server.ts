import { AppError } from './errors';
export type Operation = 'intent' | 'quote' | 'history' | 'bridgeStatus' | 'price';
export function hosted(request: Request) {
  return process.env.VERCEL === '1' || !['localhost', '127.0.0.1'].includes(new URL(request.url).hostname) || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.get('host') || '');
}
export async function protectPublicApi(request: Request, _operation: Operation) {
  if (process.env.API_ENABLED === 'false') throw new AppError('PAUSED', 'The demo is temporarily paused.', 503);
  // Hosted access is enabled only after configuring Vercel's persistent edge
  // rate limits. This switch is an operator gate, not a rate limiter itself.
  if (hosted(request) && process.env.PUBLIC_API_ENABLED !== 'true') throw new AppError('PROTECTION', 'The public demo is not available yet.', 503);
}
