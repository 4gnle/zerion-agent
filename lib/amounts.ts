import { formatUnits, parseUnits } from 'viem';
import { CAP } from './config';
import { decimal, type ReadyIntent } from './intent';
import { AppError } from './errors';
export const usdc = (units: bigint | string) => formatUnits(BigInt(units), 6);
export function exactAmount(value: string) {
  if (!decimal.test(value)) throw new AppError('PRECISION', 'Use a positive USDC amount with up to 6 decimal places.');
  const units = parseUnits(value, 6);
  if (units <= 0n) throw new AppError('ZERO', 'This amount is too small to swap.');
  return units;
}
export function amountFor(i: ReadyIntent, balance: bigint) {
  const amount = i.amountType === 'percentage' ? balance * BigInt(i.amount) / 100n : exactAmount(i.amount);
  if (amount <= 0n) throw new AppError('ZERO', 'This amount is too small to swap.');
  if (amount > CAP) throw new AppError('CAP', 'This prototype supports swaps up to 10 USDC. Enter a smaller amount.');
  if (amount > balance) throw new AppError('BALANCE', 'Your Base balance is lower than this amount.');
  return amount;
}
export function checkFreshBalance(i: ReadyIntent, reviewed: bigint, current: bigint, amount: bigint) {
  if (i.amountType === 'percentage' && reviewed !== current) throw new AppError('BALANCE_CHANGED', 'Your USDC balance changed. Edit and review the recalculated amount.');
  if (amount > current) throw new AppError('BALANCE', 'Your Base balance is lower than this amount.');
}
