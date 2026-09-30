import { extract, MODEL } from '../lib/intent.server';
import fixtures from '../fixtures/intent-cases.json';
async function main() {
 let passed=0, failed=0, input=0, output=0;
 for(const c of fixtures.cases.filter(c=>process.argv.includes('--base-boundary') ? c.text === 'swap half my ETH for USDC on Base' : process.argv.includes('--new') ? c.text.includes('$') || c.text === 'Bridge half my ETH from Arbitrum to USDC on Base' || c.text === 'swap half my ETH for USDC on Base' : process.argv.includes('--bridge') ? c.text.startsWith('Bridge 0.001 ETH') || c.text.startsWith('Bridge half my ETH from Ethereum') : c.liveSmoke && (!process.argv.includes('--dollars') || c.text.includes('$')))) {
  try { const r=await extract(c.text); input+=r.usage?.input_tokens||0; output+=r.usage?.output_tokens||0;
   if(Object.entries(c.expected).every(([k,v])=>r.intent[k as keyof typeof r.intent]===v)) passed++; else {failed++; console.log('Mismatch:',c.text);}
  } catch {failed++; console.log('Unavailable:',c.text);}
 }
 console.log(JSON.stringify({model:MODEL,passed,failed,inputTokens:input,outputTokens:output}));
 if(failed) process.exitCode=1;
}
void main();
