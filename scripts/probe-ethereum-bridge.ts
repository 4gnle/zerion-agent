import { mkdir, writeFile } from 'node:fs/promises';
const key=process.env.ZERION_API_KEY,account=process.env.PROBE_REFERENCE_ADDRESS || process.env.DEMO_WALLET_ADDRESS;
if(!key||!account)throw new Error('Missing probe configuration');
const url=new URL('https://api.zerion.io/v1/swap/quotes/');
url.search=new URLSearchParams({currency:'usd',from:account,to:account,'input[chain_id]':'ethereum','input[fungible_id]':'eth','input[amount]':'0.001','output[chain_id]':'arbitrum','output[fungible_id]':'eth',slippage_percent:'0.5'}).toString();
const r=await fetch(url,{headers:{Authorization:`Basic ${Buffer.from(`${key}:`).toString('base64')}`,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
if(!r.ok)throw new Error(`Zerion HTTP ${r.status}`);
const result=await r.json();await mkdir('.local',{recursive:true});await writeFile(process.env.PROBE_REFERENCE_ADDRESS ? '.local/ethereum-bridge-reference.json' : '.local/ethereum-bridge.json',JSON.stringify(result),{mode:0o600});
console.log(JSON.stringify(result.data.map((q:any)=>({id:q.id,source:q.attributes.liquidity_source.id,error:q.attributes.error?.code,keys:Object.keys(q.attributes),to:q.attributes.transaction_swap?.evm?.to,selector:q.attributes.transaction_swap?.evm?.data?.slice(0,10),value:q.attributes.transaction_swap?.evm?.value,output:q.attributes.output_amount?.quantity}))));
