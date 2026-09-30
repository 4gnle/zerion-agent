import { formatUnits, parseUnits } from 'viem';
import { tokenCap, tokenDecimals } from './routes';
import { decimal, intentRoute, type ReadyIntent } from './intent';
import { AppError } from './errors';
export const eth = (units: bigint | string) => formatUnits(BigInt(units), 18);
export const usdc = (units: bigint | string) => formatUnits(BigInt(units), 6);
export function exactAmount(value: string) {
  if (!decimal.test(value)) throw new AppError('PRECISION', 'Use a positive ETH amount with up to 18 decimal places.');
  const units = parseUnits(value, 18);
  if (units <= 0n) throw new AppError('ZERO', 'This amount is too small to swap.');
  return units;
}
export function amountFor(i: ReadyIntent, balance: bigint) {
  if (i.amountType === 'usd') throw new AppError('PRICE', 'Resolve the dollar amount before calculating the token amount.');
  const token = intentRoute(i).sellToken;
  if (i.amountType === 'exact' && !new RegExp(`^[0-9]+(?:\\.[0-9]{1,${tokenDecimals(token)}})?$`).test(i.amount)) throw new AppError('PRECISION', 'Too many token decimals.');
  const amount = i.amountType === 'percentage' ? balance * BigInt(i.amount) / 100n : parseUnits(i.amount, tokenDecimals(token));
  if (amount <= 0n) throw new AppError('ZERO', 'This amount is too small to swap.');
  if (amount > tokenCap(token)) throw new AppError('CAP', `This prototype supports up to ${token === 'ETH' ? '0.002 ETH' : '20 USDC'} per action.`);
  if (amount > balance) throw new AppError('BALANCE', `Your ${token} balance is lower than this amount.`);
  if (token === 'ETH' && amount === balance) throw new AppError('GAS_RESERVE', 'Leave some ETH on the source network for gas. Try half or a smaller exact amount.');
  return amount;
}
export function checkFreshBalance(i: ReadyIntent, reviewed: bigint, current: bigint, amount: bigint) {
  if (i.amountType === 'percentage' && reviewed !== current) throw new AppError('BALANCE_CHANGED', 'Your input-token balance changed. Edit and review the recalculated amount.');
  if (intentRoute(i).sellToken === 'ETH' ? amount >= current : amount > current) throw new AppError('BALANCE', 'The input balance is insufficient; ETH inputs must also leave room for gas.');
}

export function usdToWei(usd: string, price: string) {
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(usd) || !/^[0-9]+(?:\.[0-9]{1,18})?$/.test(price)) throw new AppError('PRICE', 'A valid dollar amount and fresh token price are required.');
  const denominator = parseUnits(price, 18);
  if (denominator <= 0n) throw new AppError('PRICE', 'Token price is unavailable.');
  const result = parseUnits(usd, 18) * 10n ** 18n / denominator;
  if (result <= 0n) throw new AppError('ZERO', 'This dollar amount is too small.');
  return result;
}

export function usdToToken(usd: string, price: string, token: 'ETH' | 'USDC') { return usdToWei(usd, price) / 10n ** BigInt(18 - tokenDecimals(token)); }
