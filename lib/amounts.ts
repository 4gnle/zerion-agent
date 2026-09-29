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
