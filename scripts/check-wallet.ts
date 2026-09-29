import { isAddress, formatEther, type Address } from 'viem';
import { readBalances } from '../lib/rpc';
import { usdc } from '../lib/amounts';
async function main(){
 const account=process.env.DEMO_WALLET_ADDRESS;
 if(!account||!isAddress(account,{strict:false}))throw new Error('Set your public DEMO_WALLET_ADDRESS.');
 const b=await readBalances(account as Address);
 console.log(JSON.stringify({network:'Arbitrum One',USDC:usdc(b.usdc),ETH:formatEther(b.eth),readOnly:true}));
}
main().catch(()=>{console.error('Wallet balance check unavailable; no transaction was submitted.');process.exitCode=1;});
