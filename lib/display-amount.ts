/** Display only: truncate fractional digits, retaining the first nonzero digit for tiny amounts. */
export function displayAmount(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const [, whole, fraction = ''] = match;
  const first = fraction.search(/[1-9]/);
  const precision = /^0+$/.test(whole) ? first + 1 : 1;
  const kept = fraction.slice(0, Math.max(0, precision)).replace(/0+$/, '');
  const truncated = `${whole}${kept ? `.${kept}` : ''}`;
  return /[1-9]/.test(fraction.slice(Math.max(0, precision))) ? `≈ ${truncated}` : truncated;
}
