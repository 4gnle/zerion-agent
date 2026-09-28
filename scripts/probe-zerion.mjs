/** Read-only probe. Never signs or broadcasts. Node 22+. No dependencies. */
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const API = 'https://api.zerion.io';

export function quoteParams(account, amount, inputId, outputId) {
  return new URLSearchParams({
    currency: 'usd', from: account, to: account,
    'input[chain_id]': 'base', 'input[fungible_id]': inputId,
    'input[amount]': amount, 'output[chain_id]': 'base',
    'output[fungible_id]': outputId, slippage_percent: '0.5',
  });
}

async function main() {
  const key = process.env.ZERION_API_KEY;
  const account = process.env.DEMO_WALLET_ADDRESS;
  const amount = process.env.PROBE_USDC_AMOUNT || '1';
  if (!key) throw new Error('Set ZERION_API_KEY in .env.local.');
  if (!/^0x[0-9a-fA-F]{40}$/.test(account || '') || /^0x0{40}$/i.test(account)) {
    throw new Error('Set DEMO_WALLET_ADDRESS to your public EOA address.');
  }
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(amount)) {
    throw new Error('PROBE_USDC_AMOUNT must be a decimal USDC amount with <=6 places.');
  }
  const [whole, fraction = ''] = amount.split('.');
  const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  if (units <= 0n || units > 10_000_000n) throw new Error('Probe amount must be >0 and <=10 USDC.');

  async function get(path, params) {
    const url = new URL(path, API);
    url.search = params.toString();
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000), redirect: 'error',
      });
    } catch {
      throw new Error('Network request failed or timed out; no transaction was submitted.');
    }
    if (!response.ok) {
      // Do not print upstream bodies, request headers, or credentials.
      throw new Error(`Zerion returned HTTP ${response.status} for ${path}. Check access/quota and retry manually.`);
    }
    try { return await response.json(); }
    catch { throw new Error('Zerion returned non-JSON data.'); }
  }

  const lookup = implementation => get('/v1/fungibles/by-implementation', new URLSearchParams({implementation}));
  const sell = await lookup(`base:${USDC}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  const buy = await lookup('base');
  const implementation = sell?.data?.attributes?.implementations?.find(
    item => item.chain_id === 'base' && item.address?.toLowerCase() === USDC.toLowerCase()
  );
  if (!implementation || implementation.decimals !== 6 || !sell?.data?.id || !buy?.data?.id) {
    throw new Error('Asset metadata did not match the fixed pair; inspect the current schema before continuing.');
  }
  if (buy?.data?.attributes?.symbol?.toUpperCase() !== 'ETH') {
    throw new Error('Base native lookup did not resolve ETH.');
  }
  await new Promise(resolve => setTimeout(resolve, 1500));
  const result = await get('/v1/swap/quotes/', quoteParams(account, amount, sell.data.id, buy.data.id));
  if (!Array.isArray(result.data)) throw new Error('Quote response did not contain data[].');
  // Local inspection only: public quote data, never request headers or keys.
  if (process.env.PROBE_SAVE === '1') {
    await mkdir('.local', { recursive: true });
    await writeFile('.local/zerion-quote.json', JSON.stringify(result), { mode: 0o600 });
  }
  const routes = result.data.map(quote => {
    const a = quote.attributes || {};
    const t = a.transaction_swap?.evm;
    const p = a.transaction_approve?.evm;
    const r = quote.relationships || {};
    return {
      sourceId: a.liquidity_source?.id, sourceName: a.liquidity_source?.name,
      providerError: a.error?.code || null,
      input: a.input_amount?.quantity, expected: a.output_amount?.quantity,
      minimum: a.minimum_output_amount?.quantity, slippage: a.slippage_percent,
      inputChain: r.input_chain?.data?.id, outputChain: r.output_chain?.data?.id,
      inputAssetMatches: r.input_fungible?.data?.id === sell.data.id,
      outputAssetMatches: r.output_fungible?.data?.id === buy.data.id,
      hasSwapPayload: Boolean(t), hasApprovalPayload: Boolean(p),
      transactionChain: t?.chain_id, transactionValue: t?.value,
      transactionType: t?.type,
      signerMatches: t?.from?.toLowerCase() === account.toLowerCase(),
      router: t?.to,
      approvalTargetsUSDC: p ? p.to?.toLowerCase() === USDC.toLowerCase() : null,
      approvalSelector: p?.data?.slice(0, 10),
      hasBridgeFee: Boolean(a.bridge_fee),
      networkFeeKnown: Boolean(a.network_fee),
    };
  });
  console.log(JSON.stringify({
    readOnly: true, sellAssetId: sell.data.id, buyAssetId: buy.data.id,
    amountUSDC: amount, routeCount: routes.length, routes,
    note: 'Access/schema probe only. No route has been security-validated, simulated, signed, or executed. Insufficient funds may produce informational quotes. Select an atomic source only after inspecting its official docs.',
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
