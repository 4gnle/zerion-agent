import { type Address, type Hash, type WalletClient } from 'viem';
import { arbitrum, mainnet } from './config';
import { AppError } from './errors';
import { assertSignable, type Quote } from './quote';
import { publicClient, clientFor, readBalances } from './rpc';
import { checkFreshBalance } from './amounts';
import type { ReadyIntent } from './intent';
export type Pending = { hash: Hash; chain: 1 | 42161; destination?: 8453; account: Address; sell: string; expected: string; source: string; minimum?: string; sourceConfirmed?: boolean; replaced?: boolean };
function rejected(error: unknown): boolean {
  let value: unknown = error;
  for (let depth = 0; depth < 8 && value && typeof value === 'object'; depth++) {
    if ('code' in value && value.code === 4001) return true;
    if ('name' in value && value.name === 'UserRejectedRequestError') return true;
    value = 'cause' in value ? value.cause : null;
  }
  return false;
}
export async function sendSwap(q: Quote, wallet: WalletClient, intent: ReadyIntent, reviewedBalance: bigint, stillCurrent: () => boolean) {
  const verifyWallet = async () => {
    const [accounts, chain] = await Promise.all([wallet.getAddresses(), wallet.getChainId()]);
    if (!accounts[0] || !stillCurrent()) throw new AppError('WALLET_CHANGED', 'Your account or network changed. Review a new quote.');
    assertSignable(q, accounts[0], chain);
  };
  await verifyWallet();
  const balances = await readBalances(q.account, q.chain);
  checkFreshBalance(intent, reviewedBalance, balances.eth, BigInt(q.sell));
  const client = clientFor(q.chain);
  const tx = q.swap;
  if (!tx) throw new AppError('PAYLOAD', 'A supported transaction is unavailable.');
  const request = { account: q.account, to: tx.to, data: tx.data, value: BigInt(tx.value) };
  try {
    await client.call(request);
    const [gas, gasPrice] = await Promise.all([client.estimateGas(request), client.getGasPrice()]);
    // Arbitrum gas estimates include L1 posting costs. Reserve a 2x margin;
    // the wallet still supplies the final fee settings at signing time.
    const estimate = gas * gasPrice * 2n;
    if (balances.eth < request.value + estimate) throw new AppError('GAS', 'Leave more ETH on the source network for gas. Enter a smaller amount.');
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('PREFLIGHT', 'The transaction preflight failed. Refresh the quote before continuing.');
  }
  await verifyWallet();
  try {
    // Only called from an explicit click. Never supply upstream nonce or fee fields.
    return await wallet.sendTransaction({ ...request, chain: q.chain === 1 ? mainnet : arbitrum });
  } catch (e) {
    if (rejected(e)) throw new AppError('CANCELLED', 'Request cancelled in your wallet. Nothing was submitted for this step.');
    throw new AppError('AMBIGUOUS', 'The wallet did not return a transaction hash. Check wallet activity before starting another swap.');
  }
}
export async function monitor(pending: Pending, onReplacement: (next: Pending) => void) {
  let changedPayload = !!pending.replaced;
  const receipt = await clientFor(pending.chain).waitForTransactionReceipt({ hash: pending.hash, timeout: 90000, confirmations: 1,
    onReplaced: ({ reason, transaction }) => {
      if (reason !== 'repriced') changedPayload = true;
      onReplacement({ ...pending, hash: transaction.hash, replaced: changedPayload });
    },
  });
  if (changedPayload) throw new AppError('REPLACED', 'This transaction was cancelled or replaced with a different action. It is not a confirmed swap.');
  if (receipt.status !== 'success') throw new AppError('REVERTED', 'The transaction reverted. No successful swap was confirmed.');
  return receipt;
}
