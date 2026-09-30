import { decodeFunctionData, encodeFunctionResult, multicall3Abi, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { test, expect } from '@playwright/test';
const account='0x1111111111111111111111111111111111111111';
const router='0x6131B5fae19EA4f9D964eAc0408E4408b66337b5';
const zeroHash=`0x${'0'.repeat(64)}`;
const word=(n:bigint)=>`0x${n.toString(16).padStart(64,'0')}`;
// This browser has no real wallet: every provider request and public RPC call is mocked.
for (const action of ['swap', 'bridge', 'base'] as const) test(`mocked wallet: ${action}, balances, history, network and reload recovery`,async({page})=>{
 test.skip(!process.env.TEST_LIVE_URL,'Requires the explicitly started local live-mode test server.');
 const url=process.env.TEST_LIVE_URL!;
 await page.emulateMedia({reducedMotion:'reduce'});
 let bridgeChecks=0;
 await page.route('**/api/bridge-status',route=>route.fulfill({json:++bridgeChecks===1?{complete:false,destinationHash:null,message:action==='base'?'Arbitrum deposit confirmed. Waiting for USDC on Base.':'Ethereum deposit confirmed. Waiting for delivery on Arbitrum.'}:{complete:true,destinationHash:`0x${'c'.repeat(64)}`,message:'ETH delivered on Arbitrum.'}}));
 await page.route('**/api/history',route=>{const older=!!route.request().postDataJSON().cursor;return route.fulfill({json:{items:[{id:older?'old':'new',hash:`0x${'d'.repeat(64)}`,operation:older?'send':'receive',status:'confirmed',date:'2026-09-29T00:00:00Z',chain:'arbitrum',spam:false,transfers:[{amount:'0.002',symbol:'ETH',incoming:!older,unverified:false}]}],cursor:older?null:'next'}});});
 let quoteCalls=0;let checks=0;let swapReceiptRequests=0;
 await page.addInitScript(({account})=>{
  const listeners:Record<string,((...args:unknown[])=>void)[]>={};let sendCount=0;let chainId='0x1';
  const provider={isMetaMask:true,on:(name:string,fn:(...args:unknown[])=>void)=>{(listeners[name]||=[]).push(fn);},removeListener:()=>{},
   request:async({method,params}:{method:string;params?:{chainId:string}[]})=>{
    if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];
    if(method==='eth_chainId')return chainId;
    if(method==='wallet_switchEthereumChain'){chainId=params![0].chainId;for(const fn of listeners.chainChanged||[])fn(chainId);return null;}
    if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];
    if(method==='wallet_getCapabilities')return {};
    if(method==='eth_sendTransaction'){sendCount++;(window as unknown as {testSends:number}).testSends=sendCount;return `0x${(sendCount===1?'a':'b').repeat(64)}`;}
    throw new Error(`Unmocked wallet method: ${method}`);
   }};
  Object.defineProperty(window,'ethereum',{value:provider});
 },{account});
 await page.route('**/api/price',route=>route.fulfill({json:{price:'2000',fetchedAt:Date.now()}}));
 await page.route('**/api/intent',route=>route.fulfill({json:{intent:{status:'ready',sellToken:'ETH',buyToken:action==='bridge'?'ETH':'USDC',chain:action==='bridge'?'ethereum':action==='base'?'base':'arbitrum',amountType:action==='base'?'usd':'percentage',amount:action==='base'?'2':'50',recipient:'self',reason:'none'}}}));
 await page.route('**/api/quote',async route=>{expect(route.request().postDataJSON()).toEqual({account,sellAmountBaseUnits:'1000000000000000',...(action==='bridge'?{action:'bridge'}:action==='base'?{action:'base'}:{})});quoteCalls++;const now=Date.now();await route.fulfill({json:{quote:{mode:'live',requestId:String(quoteCalls),providerId:'mock',account,chain:action==='bridge'?1:42161,...(action==='base'?{destination:8453}:{}),sell:'1000000000000000',expected:action==='bridge'?'0.00099':'2.7',minimum:action==='bridge'?'0.00098':'2.6865',sourceId:action!=='swap'?'lifi':'kyber',sourceName:action!=='swap'?'LI.FI':'KyberSwap',fetchedAt:now,validUntil:now+30000,networkFee:{label:'~$0.01',inclusion:'Mock'},providerFee:{label:'0',inclusion:'Mock'},swap:{to:action!=='swap'?'0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE':router,value:'1000000000000000',data:'0xe21fd0e9'},executable:true,blockedReason:null}}});});
 await page.route(url => url.href.startsWith('https://arb1.arbitrum.io/') || url.href.startsWith(mainnet.rpcUrls.default.http[0]),async route=>{
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
 await expect(page.getByLabel('Connected network',{exact:true})).toContainText('Not connected');
 await page.getByRole('button',{name:'Connect wallet',exact:true}).click();
 await page.getByRole('button',{name:'Injected',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Let’s review that again'})).not.toBeVisible();
 await expect(page.getByLabel('Connected network',{exact:true})).toContainText('Ethereum');
 await page.locator('.balance-dropdown > summary').click();
 await expect(page.getByLabel('Wallet balances')).toContainText('on Ethereum');
 await expect(page.getByLabel('Wallet balances')).toContainText('0.002');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'.local/wallet-balances-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.keyboard.press('Escape');
 await expect(page.getByLabel('Wallet balances')).not.toBeVisible();
 await page.setViewportSize({width:1440,height:1000});
 await expect(page.getByLabel('Wallet history')).toContainText('receive');
 await page.getByRole('button',{name:'Load older transactions'}).click();
 await expect(page.getByLabel('Wallet history')).toContainText('send');
 await page.screenshot({path:'.local/wallet-dashboard-desktop.png',fullPage:true});
 await page.getByLabel('Connected network',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Base',exact:true})).toBeVisible();
 if(action==='base') await page.screenshot({path:'.local/chain-popover-desktop.png',fullPage:true});
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Base',exact:true})).not.toBeVisible();
 await page.getByLabel('Connected network',{exact:true}).click();
 await page.getByRole('button',{name:'Arbitrum',exact:true}).click();
 await expect(page.getByLabel('Connected network',{exact:true})).toContainText('Arbitrum');
 await page.getByLabel('Connected network',{exact:true}).click();
 await page.getByRole('button',{name:'Ethereum',exact:true}).click();
 await expect(page.getByLabel('Connected network',{exact:true})).toContainText('Ethereum');
 await page.getByLabel('What would you like to do?').fill(action==='base'?'Bridge $2 of ETH from Arbitrum to Base then swap to USDC':action==='bridge'?'Bridge half my ETH from Ethereum to Arbitrum':'Swap half my ETH for USDC');
 await page.getByRole('button',{name:'Submit instruction',exact:true}).click();
 expect(quoteCalls).toBe(0);
 if(action!=='bridge') {
   await page.getByRole('button',{name:'Switch to Arbitrum',exact:true}).click();
   await expect(page.getByLabel('Connected network',{exact:true})).toContainText('Arbitrum');
   await page.getByRole('button',{name:'Get quote'}).click();
 }
 const confirm=action==='base'?'Confirm plan':action==='bridge'?'Confirm bridge':'Confirm swap';
 await expect(page.getByRole('button',{name:confirm,exact:true})).toBeVisible();expect(quoteCalls).toBe(1);expect(await page.evaluate(()=>(window as unknown as {testSends?:number}).testSends||0)).toBe(0);
 if(action==='base'){await expect(page.getByLabel('Execution plan')).toContainText('USDC on Base');await expect(page.getByText('In the same wallet, on Base',{exact:true})).toBeVisible();await expect(page.getByText('Not separately provided',{exact:true})).toBeVisible();await expect(page.getByText(/One wallet confirmation on Arbitrum/)).toBeVisible();await expect(page.getByText(/Approximately \$2 of ETH/)).toBeVisible();await page.screenshot({path:'.local/base-plan-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local/base-plan-mobile.png',fullPage:false});await page.setViewportSize({width:1440,height:1000});}
 await page.getByRole('button',{name:confirm,exact:true}).click();
 await expect(page.getByText(action==='base'?'Waiting for Arbitrum confirmation…':action==='bridge'?'Waiting for Ethereum confirmation…':'Waiting for swap confirmation…',{exact:true}).last()).toBeVisible();expect(await page.evaluate(()=>(window as unknown as {testSends:number}).testSends)).toBe(1);
 await page.reload();
 if(action!=='swap'){await expect(page.getByText(action==='base'?'Arbitrum deposit confirmed. Waiting for USDC on Base.':'Ethereum deposit confirmed. Waiting for delivery on Arbitrum.',{exact:true}).last()).toBeVisible();await expect(page.getByRole('heading',{name:'Bridge complete'})).not.toBeVisible();await page.getByRole('button',{name:'Check status'}).click();}
 await expect(page.getByRole('heading',{name:action==='base'?'Plan complete':action==='bridge'?'Bridge complete':'Swap confirmed'})).toBeVisible();expect(checks).toBeGreaterThanOrEqual(1);expect(await page.evaluate(()=>(window as unknown as {testSends?:number}).testSends||0)).toBe(0);
});
