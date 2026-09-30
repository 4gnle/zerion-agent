import { expect, it } from 'vitest';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { routeSchema, chainSlug, tokenAddress, tokenDecimals, type Route, type ChainId, type Token } from '../lib/routes';
import { normalizeQuote, assertSignable, KYBER_ROUTER, LIFI_ROUTER } from '../lib/quote';
import { validateIntent } from '../lib/intent';
import { amountFor, usdToToken } from '../lib/amounts';
import { restore } from '../lib/recovery';
import { bridgeResult } from '../lib/bridge-status';
const account='0x1111111111111111111111111111111111111111';
const hash=`0x${'a'.repeat(64)}`;
const routes:Route[]=[];
for(const from of [1,42161,8453] as ChainId[]) for(const to of [1,42161,8453] as ChainId[]) for(const sellToken of ['ETH','USDC'] as Token[]) for(const buyToken of ['ETH','USDC'] as Token[]) if(from!==to||sellToken!==buyToken) routes.push({from,to,sellToken,buyToken});
function fixture(route:Route) {
 const source=route.from===route.to?'kyber':'lifi',router=source==='kyber'?KYBER_ROUTER:LIFI_ROUTER;
 const quantity=route.sellToken==='ETH'?'0.001':'2';const amount=parseUnits(quantity,tokenDecimals(route.sellToken));
 const output=route.buyToken==='ETH'?'0.0005':'1.9';
 const tx={from:account,to:router,chain_id:`0x${route.from.toString(16)}`,value:route.sellToken==='ETH'?`0x${amount.toString(16)}`:'0x0',data:'0xe21fd0e9'};
 const raw={id:'route',attributes:{liquidity_source:{id:source,name:source},input_amount:{quantity},output_amount:{quantity:output},minimum_output_amount:{quantity:output},slippage_percent:0.5,transaction_swap:{evm:tx}},relationships:{input_chain:{data:{id:chainSlug(route.from)}},output_chain:{data:{id:chainSlug(route.to)}},input_fungible:{data:{id:route.sellToken}},output_fungible:{data:{id:route.buyToken}}}};
 return {raw,amount,quantity,source,router,output};
}
it.each(routes)('supports $sellToken $from → $buyToken $to with exact network/token boundaries',route=>{
 const {raw,amount,quantity,source,output}=fixture(route);
 const intent=validateIntent({route,status:'ready',sellToken:route.sellToken,buyToken:route.buyToken,chain:chainSlug(route.from),amountType:'exact',amount:quantity,recipient:'self',reason:'none'});
 expect(amountFor(intent,amount*2n)).toBe(amount);
 const q=normalizeQuote(raw,account,amount,{sell:route.sellToken,buy:route.buyToken},source,Date.now(),false,false,route);
 expect(()=>assertSignable(q,account,route.from)).not.toThrow();
 expect(()=>assertSignable(q,account,route.from===1?8453:1)).toThrow();
 const pending={hash,chain:route.from,...(route.from!==route.to?{destination:route.to}:{}),route,account,sell:String(amount),expected:output,minimum:output,source};
 expect(restore(JSON.stringify(pending))?.route).toEqual(route);
 if(route.from!==route.to){
  const status={status:'DONE',substatus:'COMPLETED',fromAddress:account,toAddress:account,sending:{txHash:hash,chainId:route.from},receiving:{txHash:`0x${'b'.repeat(64)}`,chainId:route.to,amount:String(parseUnits(output,tokenDecimals(route.buyToken))),token:{address:tokenAddress(route.to,route.buyToken),decimals:tokenDecimals(route.buyToken)}}};
  expect(bridgeResult(status,hash,account,output,false,route).complete).toBe(true);
  status.receiving.chainId=route.from;expect(()=>bridgeResult(status,hash,account,output,false,route)).toThrow();
 }
 raw.relationships.output_chain.data.id='polygon';expect(()=>normalizeQuote(raw,account,amount,{sell:route.sellToken,buy:route.buyToken},source,Date.now(),false,false,route)).toThrow();
});
it.each(['spender','token','amount','method','value','chain','sender','permit'])('rejects unsafe USDC approval: %s',field=>{
 const route:Route={from:8453,to:42161,sellToken:'USDC',buyToken:'USDC'};
 const {raw,amount,source,router}=fixture(route);
 const tx={from:account,to:tokenAddress(8453,'USDC') as string,chain_id:'0x2105',value:'0x0',data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[router,amount]})};
 if(field==='spender')tx.data=encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[account,amount]});
 if(field==='token')tx.to=account;
 if(field==='amount')tx.data=encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[router,amount-1n]});
 if(field==='method')tx.data=encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[router,amount]});
 if(field==='value')tx.value='0x1';
 if(field==='chain')tx.chain_id='0x1';
 if(field==='sender')tx.from=router;
 Object.assign(raw.attributes,{transaction_approve:{evm:tx},...(field==='permit'?{permit:{}}:{})});
 expect(()=>normalizeQuote(raw,account,amount,{sell:'USDC',buy:'USDC'},source,Date.now(),false,false,route)).toThrow();
});
it('accepts validated upstream approval but leaves execution to an exact-amount local approval',()=>{
 const route:Route={from:8453,to:42161,sellToken:'USDC',buyToken:'USDC'};const {raw,amount,source,router}=fixture(route);
 Object.assign(raw.attributes,{transaction_approve:{evm:{from:account,to:tokenAddress(8453,'USDC'),chain_id:'0x2105',value:'0x0',data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[router,2n**256n-1n]})}}});
 expect(normalizeQuote(raw,account,amount,{sell:'USDC',buy:'USDC'},source,Date.now(),false,false,route).swap?.value).toBe('0');
});
it('rejects no-op and unsupported routes and keeps USDC dollar conversion precise',()=>{
 expect(routes).toHaveLength(30);
 expect(routeSchema.safeParse({from:8453,to:8453,sellToken:'USDC',buyToken:'USDC'}).success).toBe(false);
 expect(routeSchema.safeParse({from:8453,to:42161,sellToken:'ARB',buyToken:'USDC'}).success).toBe(false);
 expect(usdToToken('2','0.9999','USDC')).toBe(2000200n);
});

it('explains source-chain gas shortages for USDC routes',()=>{
 const route:Route={from:8453,to:8453,sellToken:'USDC',buyToken:'ETH'};const {raw,amount,source}=fixture(route);
 Object.assign(raw.attributes,{error:{code:'not_enough_base_asset_balance'},transaction_swap:null});
 expect(normalizeQuote(raw,account,amount,{sell:'USDC',buy:'ETH'},source,Date.now(),false,false,route)).toMatchObject({executable:false,blockedReason:'Not enough ETH on Base for network fees.'});
});
