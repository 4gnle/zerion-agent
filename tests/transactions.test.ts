import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, encodeFunctionResult, erc20Abi, type WalletClient, type Address, type Hash } from 'viem';
vi.mock('../lib/rpc',()=>{ const client={readContract:vi.fn(),call:vi.fn(),estimateGas:vi.fn(),getGasPrice:vi.fn(),waitForTransactionReceipt:vi.fn()};return {publicClient:client,clientFor:()=>client,readBalances:vi.fn()}; });
import { publicClient, readBalances } from '../lib/rpc';
import { monitor, sendSwap, type Pending } from '../lib/transactions';
import { simulatedQuote } from '../lib/simulation';
import { KYBER_ROUTER, type Quote } from '../lib/quote';
import { validateIntent } from '../lib/intent';
import fixtures from '../fixtures/intent-cases.json';
const account:Address='0x1111111111111111111111111111111111111111';
const hash=`0x${'a'.repeat(64)}` as Hash;
const nextHash=`0x${'b'.repeat(64)}` as Hash;
const ready=validateIntent(fixtures.cases[0].expected);
const tx={to:KYBER_ROUTER,data:'0xe21fd0e9' as const,value:'1000000000000000'};
const q=():Quote=>({...simulatedQuote(1000000000000000n),account,mode:'live',sourceId:'kyber',executable:true,swap:tx});
const pending:Pending={hash,account,chain:42161,sell:'1000000000000000',expected:'2.7',source:'KyberSwap'};
const wallet={getAddresses:vi.fn(),getChainId:vi.fn(),sendTransaction:vi.fn()};
beforeEach(()=>{
 vi.resetAllMocks();wallet.getAddresses.mockResolvedValue([account]);wallet.getChainId.mockResolvedValue(42161);wallet.sendTransaction.mockResolvedValue(hash);
 vi.mocked(readBalances).mockResolvedValue({usdc:10000000n,eth:2000000000000000n});
 vi.mocked(publicClient.call).mockResolvedValue({data:encodeFunctionResult({abi:erc20Abi,functionName:'approve',result:true})});vi.mocked(publicClient.estimateGas).mockResolvedValue(50000n);vi.mocked(publicClient.getGasPrice).mockResolvedValue(1000000n);
});
const send=(quote=q(),current=()=>true)=>sendSwap(quote,wallet as unknown as WalletClient,ready,2000000000000000n,current);
describe('transaction boundary',()=>{
 it('sends native ETH once, without an approval',async()=>{await send();expect(wallet.sendTransaction).toHaveBeenCalledOnce();expect(wallet.sendTransaction).toHaveBeenCalledWith(expect.objectContaining({to:KYBER_ROUTER,value:1000000000000000n}));});
 it('requires enough balance for input plus gas margin',async()=>{vi.mocked(publicClient.estimateGas).mockResolvedValue(600000000n);await expect(send()).rejects.toMatchObject({code:'GAS'});expect(wallet.sendTransaction).not.toHaveBeenCalled();});
 it('blocks a failed preflight',async()=>{vi.mocked(publicClient.call).mockRejectedValue(new Error('revert'));await expect(send()).rejects.toMatchObject({code:'PREFLIGHT'});expect(wallet.sendTransaction).not.toHaveBeenCalled();});
 it('blocks simulation at the signing boundary',async()=>{await expect(send(simulatedQuote(1000000000000000n))).rejects.toThrow();expect(wallet.sendTransaction).not.toHaveBeenCalled();});
 it('rejects account change after estimation',async()=>{wallet.getAddresses.mockResolvedValueOnce([account]).mockResolvedValueOnce(['0x2222222222222222222222222222222222222222']);await expect(send()).rejects.toThrow();expect(wallet.sendTransaction).not.toHaveBeenCalled();});
 it('rejects stale attempts even with same wallet',async()=>{await expect(send(q(),()=>false)).rejects.toThrow();expect(wallet.sendTransaction).not.toHaveBeenCalled();});
 it('checks expiry after preflight',async()=>{const quote=q();vi.mocked(publicClient.estimateGas).mockImplementation(async()=>{quote.validUntil=0;return 50000n;});await expect(send(quote)).rejects.toThrow('Refresh');expect(wallet.sendTransaction).not.toHaveBeenCalled();});
 it('classifies explicit rejection and ambiguous send without retry',async()=>{wallet.sendTransaction.mockRejectedValue({code:4001});await expect(send()).rejects.toMatchObject({code:'CANCELLED'});wallet.sendTransaction.mockRejectedValue(new Error('network'));await expect(send()).rejects.toMatchObject({code:'AMBIGUOUS'});expect(wallet.sendTransaction).toHaveBeenCalledTimes(2);});
 it('a timeout does not resubmit',async()=>{vi.mocked(publicClient.waitForTransactionReceipt).mockRejectedValue(new Error('timeout'));await expect(monitor(pending,vi.fn())).rejects.toThrow();expect(wallet.sendTransaction).not.toHaveBeenCalled();});
 it('reverted receipt is not success',async()=>{vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValue({status:'reverted'} as never);await expect(monitor(pending,vi.fn())).rejects.toMatchObject({code:'REVERTED'});});
 it.each(['repriced','cancelled','replaced'] as const)('handles %s replacement',async reason=>{const callback=vi.fn();vi.mocked(publicClient.waitForTransactionReceipt).mockImplementation(async options=>{options.onReplaced?.({reason,transaction:{hash:nextHash}} as never);return {status:'success',transactionHash:nextHash} as never;});if(reason==='repriced') await expect(monitor(pending,callback)).resolves.toMatchObject({status:'success'});else await expect(monitor(pending,callback)).rejects.toMatchObject({code:'REPLACED'});expect(callback).toHaveBeenCalledWith(expect.objectContaining({hash:nextHash,replaced:reason!=='repriced'}));});
 it('does not misclassify restored cancellation as success',async()=>{vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValue({status:'success'} as never);await expect(monitor({...pending,replaced:true},vi.fn())).rejects.toMatchObject({code:'REPLACED'});});
});

const usdcIntent=validateIntent({status:'ready',sellToken:'USDC',buyToken:'ETH',chain:'base',amountType:'exact',amount:'2',recipient:'self',reason:'none',route:{from:8453,to:8453,sellToken:'USDC',buyToken:'ETH'}});
const usdcQuote=():Quote=>({...q(),chain:8453,route:{from:8453,to:8453,sellToken:'USDC',buyToken:'ETH'},sell:'2000000',expected:'0.0007',minimum:'0.0006',approvalRequired:true,swap:{...tx,value:'0'}});
it('USDC approval uses only the exact amount and allowlisted router, and never sends the swap',async()=>{
 wallet.getChainId.mockResolvedValue(8453);
 await sendSwap(usdcQuote(),wallet as unknown as WalletClient,usdcIntent,10000000n,()=>true,true);
 expect(wallet.sendTransaction).toHaveBeenCalledOnce();
 const request=wallet.sendTransaction.mock.calls[0][0];expect(request.to.toLowerCase()).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');expect(request.value).toBe(0n);
 expect(decodeFunctionData({abi:erc20Abi,data:request.data})).toMatchObject({functionName:'approve',args:[KYBER_ROUTER,2000000n]});
});
it('USDC swap checks allowance at signing time, and never silently approves',async()=>{
 wallet.getChainId.mockResolvedValue(8453);vi.mocked(publicClient.readContract).mockResolvedValue(0n);
 await expect(sendSwap({...usdcQuote(),approvalRequired:false},wallet as unknown as WalletClient,usdcIntent,10000000n,()=>true)).rejects.toMatchObject({code:'APPROVAL'});
 expect(wallet.sendTransaction).not.toHaveBeenCalled();
 vi.mocked(publicClient.readContract).mockResolvedValue(2000000n);
 await sendSwap({...usdcQuote(),approvalRequired:false},wallet as unknown as WalletClient,usdcIntent,10000000n,()=>true);
 expect(wallet.sendTransaction).toHaveBeenCalledOnce();expect(wallet.sendTransaction.mock.calls[0][0]).toMatchObject({to:KYBER_ROUTER,value:0n});
});
it('USDC approval requires source gas and handles rejection without retry',async()=>{
 wallet.getChainId.mockResolvedValue(8453);vi.mocked(readBalances).mockResolvedValue({usdc:10000000n,eth:0n});
 await expect(sendSwap(usdcQuote(),wallet as unknown as WalletClient,usdcIntent,10000000n,()=>true,true)).rejects.toMatchObject({code:'GAS'});expect(wallet.sendTransaction).not.toHaveBeenCalled();
 vi.mocked(readBalances).mockResolvedValue({usdc:10000000n,eth:2000000000000000n});wallet.sendTransaction.mockRejectedValue({code:4001});
 await expect(sendSwap(usdcQuote(),wallet as unknown as WalletClient,usdcIntent,10000000n,()=>true,true)).rejects.toMatchObject({code:'CANCELLED'});expect(wallet.sendTransaction).toHaveBeenCalledOnce();
});
