import { formatUnits, parseUnits } from 'viem';
import { CAP } from './config';
import { decimal, type ReadyIntent } from './intent';
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
  if (i.amountType === 'usd') throw new AppError('PRICE', 'Resolve the dollar amount before calculating ETH.');
  const amount = i.amountType === 'percentage' ? balance * BigInt(i.amount) / 100n : exactAmount(i.amount);
  if (amount <= 0n) throw new AppError('ZERO', 'This amount is too small to swap.');
  if (amount > CAP) throw new AppError('CAP', 'This prototype supports swaps up to 0.002 ETH. Enter a smaller amount.');
  if (amount > balance) throw new AppError('BALANCE', `Your ${i.chain === 'ethereum' ? 'Ethereum' : 'Arbitrum'} ETH balance is lower than this amount.`);
  if (amount === balance) throw new AppError('GAS_RESERVE', 'Leave some ETH on Arbitrum for gas. Try half or a smaller exact amount.');
  return amount;
}
export function checkFreshBalance(i: ReadyIntent, reviewed: bigint, current: bigint, amount: bigint) {
  if (i.amountType === 'percentage' && reviewed !== current) throw new AppError('BALANCE_CHANGED', 'Your ETH balance changed. Edit and review the recalculated amount.');
  if (amount >= current) throw new AppError('BALANCE', 'The ETH amount must leave enough balance for network gas.');
}

export function usdToWei(usd: string, price: string) {
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(usd) || !/^[0-9]+(?:\.[0-9]{1,18})?$/.test(price)) throw new AppError('PRICE', 'A valid dollar amount and fresh ETH price are required.');
  const denominator = parseUnits(price, 18);
  if (denominator <= 0n) throw new AppError('PRICE', 'ETH price is unavailable.');
  const result = parseUnits(usd, 18) * 10n ** 18n / denominator;
  if (result <= 0n) throw new AppError('ZERO', 'This dollar amount is too small.');
  return result;
}
