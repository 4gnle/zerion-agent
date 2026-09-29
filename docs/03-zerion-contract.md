# Zerion adapter contract

Arbitrum route verified read-only September 29, 2026. Run `npm run probe`; it requests metadata and a 0.001 ETH quote, normalizes Kyber, calls/estimates the transaction, and prints a sanitized summary. It never signs or broadcasts. Raw response stays in ignored `.local/arbitrum-quote.json`.

API origin `https://api.zerion.io`; server-only Basic auth encodes `API_KEY:`. Resolve `/v1/fungibles/by-implementation` with `arbitrum` for native ETH and `arbitrum:0xaf88d065e77c8cC2239327C5EDb3A432268e5831` for native USDC. Use returned fungible IDs, not implementation addresses. Validate USDC implementation/decimals and ETH metadata.

`GET /v1/swap/quotes/`: currency usd; from/to same account; input/output chain_id arbitrum; input native ETH ID, output USDC ID; decimal ETH input; slippage_percent 0.5. Requests are paced 1.5 seconds apart with one bounded 429 retry.

Normalize attributes liquidity_source, input/output/minimum quantities, slippage, fee amounts/inclusion, error and transaction_swap.evm. Check relationships for both chains and assets. EVM chain/value/gas fields are hexadecimal. Preserve fee unavailability rather than making up zero. Reject nonnull approval or bridge fees and unknown signing flows.

Only `kyber` is supported and pinned. Official Arbitrum MetaAggregationRouterV2: `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`. Observed selector `0xe21fd0e9`, chain `0xa4b1`, native value exactly the input amount, no approval. Validate router/account/chain/value and strict transaction fields, then preflight. No fallback to another source if unavailable.

Live read-only probe: 0.001 ETH returned an estimated 2.685425 USDC, minimum 2.671997 USDC; eth_call and gas estimation passed. Wallet balance 0.001847241847681792 ETH covered the input plus a 0.000015540140644 ETH estimated 2x gas margin. These are one-time observations, not current pricing or guaranteed fees. No receipt or live wallet signing has been verified.

Official references: [Zerion quotes](https://developers.zerion.io/api-reference/swap/get-swap-and-bridge-quotes), [Kyber deployments](https://docs.kyberswap.com/developer-guide/aggregator-api/contracts), [Kyber execution](https://docs.kyberswap.com/developer-guide/aggregator-api/how-to-guides/execute-a-swap-with-the-aggregator-api), [Circle native USDC](https://developers.circle.com/stablecoins/usdc-contract-addresses).
