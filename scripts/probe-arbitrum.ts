import { createPublicClient, http, formatEther, isAddress, type Address } from 'viem';
import { arbitrum } from 'viem/chains';
import { normalizeQuote } from '../lib/quote';
import { mkdir, writeFile } from 'node:fs/promises';
const USDC='0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
async function main(){
 const key=process.env.ZERION_API_KEY, account=process.env.DEMO_WALLET_ADDRESS;
 if(!key||!account||!isAddress(account,{strict:false}))throw new Error('Missing key or public wallet address.');
 const client=createPublicClient({chain:arbitrum,transport:http('https://arb1.arbitrum.io/rpc',{retryCount:0,timeout:15000})});
 const balance=await client.getBalance({address:account as Address});
 console.log(JSON.stringify({network:'Arbitrum One',ETH:formatEther(balance),readOnly:true}));
 async function get(path:string,params:URLSearchParams){
  const url=new URL(path,'https://api.zerion.io');url.search=params.toString();
  const r=await fetch(url,{headers:{Authorization:`Basic ${Buffer.from(`${key}:`).toString('base64')}`,Accept:'application/json'},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!r.ok)throw new Error(`Zerion HTTP ${r.status}`);return r.json();
 }
 const sell=await get('/v1/fungibles/by-implementation',new URLSearchParams({implementation:'arbitrum'}));
 await new Promise(r=>setTimeout(r,1500));
 const buy=await get('/v1/fungibles/by-implementation',new URLSearchParams({implementation:`arbitrum:${USDC}`}));
 await new Promise(r=>setTimeout(r,1500));
 const result=await get('/v1/swap/quotes/',new URLSearchParams({currency:'usd',from:account,to:account,'input[chain_id]':'arbitrum','input[fungible_id]':sell.data.id,'input[amount]':'0.001','output[chain_id]':'arbitrum','output[fungible_id]':buy.data.id,slippage_percent:'0.5'}));
 await mkdir('.local',{recursive:true});await writeFile('.local/arbitrum-quote.json',JSON.stringify(result),{mode:0o600});
 const candidate=result.data.find((q:{attributes:{liquidity_source:{id:string}}})=>q.attributes.liquidity_source.id==='kyber');
 const quote=normalizeQuote(candidate,account as Address,1000000000000000n,{sell:sell.data.id,buy:buy.data.id},'kyber');
 if(!quote.swap||!quote.executable)throw new Error('No executable Kyber route.');
 const request={account:account as Address,to:quote.swap.to,data:quote.swap.data,value:BigInt(quote.swap.value)};
 await client.call(request);
 const [gas,gasPrice]=await Promise.all([client.estimateGas(request),client.getGasPrice()]);
 console.log(JSON.stringify({source:quote.sourceId,chain:quote.chain,inputETH:'0.001',expectedUSDC:quote.expected,minimumUSDC:quote.minimum,router:quote.swap.to,selector:quote.swap.data.slice(0,10),preflight:'PASS',gasMarginETH:formatEther(gas*gasPrice*2n),fundedWithMargin:balance>=request.value+gas*gasPrice*2n,sent:false}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Probe unavailable.');process.exitCode=1;});
