import { decodeFunctionResult, erc20Abi, type Address, type Hash, type WalletClient } from 'viem';
import { base } from './config';
import { AppError } from './errors';
import { assertSignable, type Quote } from './quote';
import { publicClient, readBalances, allowance } from './rpc';
import { checkFreshBalance } from './amounts';
import type { ReadyIntent } from './intent';
export type Stage = 'approval' | 'swap';
export type Pending = { hash: Hash; chain: 8453; account: Address; stage: Stage; sell: string; expected: string; source: string; spender: Address | null };
export async function requiresApproval(q: Quote) { return !!q.spender && await allowance(q.account, q.spender) < BigInt(q.sell); }
export function afterApproval(previous: Quote, fresh: Quote) {
  if (fresh.account.toLowerCase() !== previous.account.toLowerCase() || fresh.sell !== previous.sell || fresh.sourceId !== previous.sourceId || (fresh.spender && fresh.spender.toLowerCase() !== previous.spender?.toLowerCase())) throw new AppError('ROUTE_CHANGED', 'The route or spender changed after approval. Start a new review; no swap was submitted.');
}
function rejected(error: unknown): boolean {
  let value: unknown = error;
  for (let depth = 0; depth < 8 && value && typeof value === 'object'; depth++) {
    if ('code' in value && value.code === 4001) return true;
    if ('name' in value && value.name === 'UserRejectedRequestError') return true;
    value = 'cause' in value ? value.cause : null;
  }
  return false;
}
export async function sendStep(q: Quote, stage: Stage, wallet: WalletClient, intent: ReadyIntent, reviewedBalance: bigint, stillCurrent: () => boolean) {
  const verifyWallet = async () => {
    const [accounts, chain] = await Promise.all([wallet.getAddresses(), wallet.getChainId()]);
    if (!accounts[0] || !stillCurrent()) throw new AppError('WALLET_CHANGED', 'Your account or network changed. Review a new quote.');
    assertSignable(q, accounts[0], chain);
  };
  await verifyWallet();
  const balances = await readBalances(q.account);
  checkFreshBalance(intent, reviewedBalance, balances.usdc, BigInt(q.sell));
  const needApproval = await requiresApproval(q);
  if (stage === 'swap' && needApproval) throw new AppError('ALLOWANCE', 'USDC allowance is not sufficient. Review the approval step.');
  if (stage === 'approval' && !needApproval) throw new AppError('ALLOWANCE_CHANGED', 'USDC allowance changed. Refresh the quote before continuing.');
  const tx = stage === 'approval' ? q.approval : q.swap;
  if (!tx) throw new AppError('PAYLOAD', 'A supported transaction is unavailable.');
  const request = { account: q.account, to: tx.to, data: tx.data, value: 0n };
  try {
    const result = await publicClient.call(request);
    if (stage === 'approval' && (!result.data || decodeFunctionResult({ abi: erc20Abi, functionName: 'approve', data: result.data }) !== true)) throw new Error('Approval returned false');
    const [gas, gasPrice] = await Promise.all([publicClient.estimateGas(request), publicClient.getGasPrice()]);
    // Conservative execution-gas screen. Base L1 fees and a pre-approval swap total
    // are not guaranteed by this estimate; the UI leaves final cost to the wallet.
    const estimate = gas * gasPrice * (stage === 'approval' ? 4n : 2n);
    if (balances.eth <= estimate) throw new AppError('GAS', 'You need more ETH on Base for network fees.');
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('PREFLIGHT', 'The transaction preflight failed. Refresh the quote before continuing.');
  }
  await verifyWallet();
  try {
    // Only called from an explicit click. Never supply upstream nonce or fee fields.
    return await wallet.sendTransaction({ ...request, chain: base });
  } catch (e) {
    if (rejected(e)) throw new AppError('CANCELLED', 'Request cancelled in your wallet. Nothing was submitted for this step.');
    throw new AppError('AMBIGUOUS', 'The wallet did not return a transaction hash. Check wallet activity before starting another swap.');
  }
}
export async function monitor(pending: Pending, onReplacement: (next: Pending) => void) {
  let changedPayload = false;
  const receipt = await publicClient.waitForTransactionReceipt({ hash: pending.hash, timeout: 90000, confirmations: 1,
    onReplaced: ({ reason, transaction }) => {
      if (reason !== 'repriced') changedPayload = true;
      onReplacement({ ...pending, hash: transaction.hash });
    },
  });
  if (changedPayload) throw new AppError('REPLACED', 'This transaction was cancelled or replaced with a different action. It is not a confirmed swap.');
  if (receipt.status !== 'success') throw new AppError('REVERTED', 'The transaction reverted. No successful swap was confirmed.');
  return receipt;
}
