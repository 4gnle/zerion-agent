# Zerion adapter contract

Arbitrum route verified read-only September 29, 2026. Run `npm run probe`; it requests metadata and a 0.001 ETH quote, normalizes Kyber, calls/estimates the transaction, and prints a sanitized summary. It never signs or broadcasts. Raw response stays in ignored `.local/arbitrum-quote.json`.

API origin `https://api.zerion.io`; server-only Basic auth encodes `API_KEY:`. Resolve `/v1/fungibles/by-implementation` with `arbitrum` for native ETH and `arbitrum:0xaf88d065e77c8cC2239327C5EDb3A432268e5831` for native USDC. Use returned fungible IDs, not implementation addresses. Validate USDC implementation/decimals and ETH metadata.

`GET /v1/swap/quotes/`: currency usd; from/to same account; input/output chain_id arbitrum; input native ETH ID, output USDC ID; decimal ETH input; slippage_percent 0.5. Requests are paced 1.5 seconds apart with one bounded 429 retry.

Normalize attributes liquidity_source, input/output/minimum quantities, slippage, fee amounts/inclusion, error and transaction_swap.evm. Check relationships for both chains and assets. EVM chain/value/gas fields are hexadecimal. Preserve fee unavailability rather than making up zero. Reject nonnull approval or bridge fees and unknown signing flows.

Only `kyber` is supported and pinned. Official Arbitrum MetaAggregationRouterV2: `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`. Observed selector `0xe21fd0e9`, chain `0xa4b1`, native value exactly the input amount, no approval. Validate router/account/chain/value and strict transaction fields, then preflight. No fallback to another source if unavailable.

Live read-only probe: 0.001 ETH returned an estimated 2.685425 USDC, minimum 2.671997 USDC; eth_call and gas estimation passed. Wallet balance 0.001847241847681792 ETH covered the input plus a 0.000015540140644 ETH estimated 2x gas margin. These are one-time observations, not current pricing or guaranteed fees. No receipt or live wallet signing has been verified.

Official references: [Zerion quotes](https://developers.zerion.io/api-reference/swap/get-swap-and-bridge-quotes), [Kyber deployments](https://docs.kyberswap.com/developer-guide/aggregator-api/contracts), [Kyber execution](https://docs.kyberswap.com/developer-guide/aggregator-api/how-to-guides/execute-a-swap-with-the-aggregator-api), [Circle native USDC](https://developers.circle.com/stablecoins/usdc-contract-addresses).

## Ethereum → Arbitrum native ETH bridge

Same Zerion quotes endpoint with input chain ethereum, output chain arbitrum, both fungible IDs eth. Select lifi only; configured pin ZERION_BRIDGE_SOURCE_ID=lifi. Official Ethereum diamond router 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE ([deployment](https://raw.githubusercontent.com/lifinance/contracts/main/deployments/mainnet.json)). A public funded reference quote had selector 0xa1f1ce43, native value equal to 0.001 ETH, no approval; normalization, eth_call and gas estimate (117950 gas) passed. This reference address is not the owner's wallet. Owner quotes currently report not_enough_input_asset_balance and contain no executable payload.

Bridge completion is asynchronous. Use the fixed [LI.FI status API](https://docs.li.fi/api-reference/check-the-status-of-a-cross-chain-transfer) with source tx hash, fromChain=1 and toChain=42161. Source inclusion alone is not completion; verify returned wallet/chain/token/amount and destination receipt. The app is not a bridge/router security audit.

Wallet history uses GET /v1/wallets/{account}/transactions/, currency usd, page[size]=20 and optional page[after]. All indexed networks are included; only cursor text is reused. Actual owner history returned two transactions, including an unverified token lookalike; history labels this and never uses it as native spendable ETH.
