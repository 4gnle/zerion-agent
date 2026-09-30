import { decodeFunctionData, encodeFunctionResult, multicall3Abi, erc20Abi, type Hex } from 'viem';
import { mainnet, base } from 'viem/chains';
import { test, expect } from '@playwright/test';
const account='0x1111111111111111111111111111111111111111';
const zeroHash=`0x${'0'.repeat(64)}`;
const word=(n:bigint)=>`0x${n.toString(16).padStart(64,'0')}`;
for(const scenario of ['bridge','swap','approval-reload'] as const) test(`USDC ${scenario}: explicit approval, fresh review, no automatic send`,async({page})=>{
 test.skip(!process.env.TEST_LIVE_URL);const url=process.env.TEST_LIVE_URL!;
 const selected={from:8453,to:scenario==='swap'?8453:42161,sellToken:'USDC',buyToken:scenario==='swap'?'ETH':'USDC'};
 const router=scenario==='swap'?'0x6131B5fae19EA4f9D964eAc0408E4408b66337b5':'0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
 let quoteCalls=0,checks=0,swapReceiptRequests=0;
 await page.route('**/api/history',r=>r.fulfill({json:{items:[],cursor:null}}));
 await page.route('**/api/bridge-status',r=>{expect(r.request().postDataJSON().route).toEqual(selected);return r.fulfill({json:{complete:true,destinationHash:`0x${'c'.repeat(64)}`,message:'Delivered'}});});
 await page.addInitScript(({account})=>{
  const listeners:Record<string,((...args:unknown[])=>void)[]>={};let sendCount=0;let chainId='0x2105';
  const provider={isMetaMask:true,on:(name:string,fn:(...args:unknown[])=>void)=>{(listeners[name]||=[]).push(fn);},removeListener:()=>{},
   request:async({method,params}:{method:string;params?:{chainId:string}[]})=>{
    if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];
    if(method==='eth_chainId')return chainId;
    if(method==='wallet_switchEthereumChain'){chainId=params![0].chainId;for(const fn of listeners.chainChanged||[])fn(chainId);return null;}
    if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];
    if(method==='wallet_getCapabilities')return {};
    if(method==='eth_sendTransaction'){(window as unknown as {lastSent:unknown}).lastSent=params?.[0];sendCount++;(window as unknown as {testSends:number}).testSends=sendCount;return `0x${(sendCount===1?'a':'b').repeat(64)}`;}
    throw new Error(`Unmocked wallet method: ${method}`);
   }};
  Object.defineProperty(window,'ethereum',{value:provider});
 },{account});
 await page.route('**/api/intent',r=>r.fulfill({json:{intent:{status:'ready',sellToken:'USDC',buyToken:selected.buyToken,chain:'base',amountType:'exact',amount:'2',recipient:'self',reason:'none',route:selected}}}));
 await page.route('**/api/quote',async r=>{
  expect(r.request().postDataJSON()).toEqual({account,sellAmountBaseUnits:'2000000',route:selected});quoteCalls++;const now=Date.now();
  await r.fulfill({json:{quote:{mode:'live',requestId:String(quoteCalls),providerId:'mock',account,chain:8453,...(selected.to!==8453?{destination:selected.to}:{}),route:selected,sell:'2000000',expected:selected.buyToken==='ETH'?'0.0007':'1.99',minimum:selected.buyToken==='ETH'?'0.0006':'1.98',sourceId:selected.to===8453?'kyber':'lifi',sourceName:selected.to===8453?'KyberSwap':'LI.FI',fetchedAt:now,validUntil:now+30000,networkFee:{label:'$0.01',inclusion:'Mock'},providerFee:{label:'$0.00',inclusion:'Mock'},swap:{to:router,value:'0',data:'0xe21fd0e9'},executable:true,approvalRequired:quoteCalls===1,blockedReason:null}}});
 });
 await page.route(url => url.href.startsWith('https://arb1.arbitrum.io/') || url.href.startsWith(mainnet.rpcUrls.default.http[0]) || url.href.startsWith(base.rpcUrls.default.http[0]),async route=>{
  const incoming=route.request().postDataJSON();
  const requests=Array.isArray(incoming)?incoming:[incoming];
  if(requests.some(r=>r.method==='eth_getTransactionReceipt' && String(r.params?.[0]).includes('aaaa')) && ++swapReceiptRequests===1) await new Promise(r=>setTimeout(r,1800));
  const handle=(r:{id:number;method:string;params:unknown[]})=>{
   let result:unknown;
   const request=r.params?.[0] as {data?:string}|undefined;
   if(r.method==='eth_call'){
    const selector=request?.data?.slice(0,10);
    if(selector==='0x82ad56cb'){
     const decoded=decodeFunctionData({abi:multicall3Abi,data:request!.data as Hex});
     if(decoded.functionName!=='aggregate3')throw new Error('Unexpected multicall');
     result=encodeFunctionResult({abi:multicall3Abi,functionName:'aggregate3',result:decoded.args[0].map(call=>({success:true,returnData:word(call.callData.startsWith('0x313ce567')?6n:call.callData.startsWith('0x4d2301cc')?2000000000000000n:10000000n) as Hex}))});
    }else if(selector==='0x313ce567')result=word(6n);
    else if(selector==='0xdd62ed3e')result=word(2000000n);
    else if(selector==='0x70a08231')result=word(10000000n);
    else result=word(1n);
   }else if(r.method==='eth_getBalance')result='0x71afd498d0000';
   else if(r.method==='eth_getCode')result='0x';
   else if(r.method==='eth_estimateGas')result='0xc350';
   else if(r.method==='eth_gasPrice')result='0xf4240';
   else if(r.method==='eth_blockNumber')result='0x64';
   else if(r.method==='eth_getTransactionReceipt'){
    const hash=String(r.params[0]);checks++;
    result={transactionHash:hash,transactionIndex:'0x0',blockHash:zeroHash,blockNumber:'0x64',from:account,to:router,cumulativeGasUsed:'0xc350',gasUsed:'0xc350',contractAddress:null,logs:[],logsBloom:`0x${'0'.repeat(512)}`,status:'0x1',effectiveGasPrice:'0xf4240',type:'0x2'};
   }else if(r.method==='eth_chainId')result='0xa4b1';
   else throw new Error(`Unmocked RPC: ${r.method}`);
   return {jsonrpc:'2.0',id:r.id,result};
  };
  await route.fulfill({json:Array.isArray(incoming)?incoming.map(handle):handle(incoming)});
 });
 await page.goto(url);
 await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:'Injected',exact:true}).click();
 await expect(page.getByLabel('Connected network',{exact:true})).toContainText('Base');
 await page.getByLabel('What would you like to do?').fill(scenario==='swap'?'Swap 2 USDC for ETH on Base':'swap 2 USDC from base to arbitrum');
 await page.getByRole('button',{name:'Submit instruction',exact:true}).click();
 await expect(page.getByText('You pay · Base',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Approve USDC',exact:true}).click();
 await expect(page.getByText('Waiting for USDC approval…',{exact:true}).last()).toBeVisible();
 const approval=await page.evaluate(()=>(window as unknown as {lastSent:{to:string,data:Hex,value:string}}).lastSent);
 expect(approval.to.toLowerCase()).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');expect(BigInt(approval.value)).toBe(0n);
 expect(decodeFunctionData({abi:erc20Abi,data:approval.data})).toMatchObject({functionName:'approve',args:[router,2000000n]});
 if(scenario==='approval-reload'){
  await page.reload();await expect(page.getByRole('heading',{name:'USDC approved'})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {testSends?:number}).testSends||0)).toBe(0);
  expect(quoteCalls).toBe(1);return;
 }
 const confirm=scenario==='swap'?'Confirm swap':'Confirm bridge';
 await expect(page.getByRole('button',{name:confirm,exact:true})).toBeVisible();expect(quoteCalls).toBe(2);
 expect(await page.evaluate(()=>(window as unknown as {testSends:number}).testSends)).toBe(1);
 await page.getByRole('button',{name:confirm,exact:true}).click();
 await expect(page.getByRole('heading',{name:scenario==='swap'?'Swap confirmed':'Bridge complete'})).toBeVisible();
 expect(await page.evaluate(()=>(window as unknown as {testSends:number}).testSends)).toBe(2);
 expect(checks).toBeGreaterThanOrEqual(2);
});
