# Zerion adapter reference

Verified September 28, 2026 against official docs. This is a contract reference, not proof that this owner's key can execute swaps. Start with `scripts/probe-zerion.mjs` and inspect its summary. Do not copy the documentation's sample transactions; examples are not executable or reliably chain-consistent.

## Wire contract

Base URL: `https://api.zerion.io`. Server-only HTTP Basic authentication: Base64 of `API_KEY:` including the trailing colon. `Accept: application/json`. [Authentication](https://developers.zerion.io/authentication).

Resolve IDs using `GET /v1/fungibles/by-implementation?implementation=...`:

| Asset | implementation |
|---|---|
| USDC | `base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Native ETH | `base` |

Use returned `data.id`, not the Base token address, as the quote's fungible ID. Cache successful immutable mappings in the server process. Validate USDC's Base implementation. [Lookup](https://developers.zerion.io/api-reference/fungibles/get-fungible-asset-by-implementation).

`GET /v1/swap/quotes/`, using `URLSearchParams`:

```text
currency=usd
from=<connected account>
to=<same account>
input[chain_id]=base
input[fungible_id]=<resolved USDC ID>
input[amount]=<human-readable decimal USDC>
output[chain_id]=base
output[fungible_id]=<resolved ETH ID>
slippage_percent=0.5
```

Response: `data[]`, each with `attributes` and `relationships`.

| Field under attributes | Adapter use |
|---|---|
| `liquidity_source.id/name` | Route identity |
| `input_amount.quantity` | Check sell amount |
| `output_amount.quantity` | Estimated output |
| `minimum_output_amount.quantity` | Minimum quoted output |
| `output_amount_after_fees` | Provider net-value comparison; not necessarily wallet credit |
| `slippage_percent` | Verify requested tolerance |
| `protocol_fee`, `bridge_fee`, `network_fee` | Display actual fees/inclusion flags |
| `transaction_approve.evm` | Optional approval payload |
| `transaction_swap.evm` | Required for execution |
| `error` | Non-executable quote |

EVM payload numbers are hexadecimal strings. Key fields: `from`, `to`, `chain_id`, `data`, `value`, `nonce`, `gas`; legacy `gas_price` or EIP-1559 `max_fee`/`max_priority_fee`. Relationship IDs identify both chains/assets. Missing fiat values are unavailable, not zero. [Quote contract and OpenAPI](https://developers.zerion.io/api-reference/swap/get-swap-and-bridge-quotes).

## Application policy — our decisions

Do not blindly use the first route. Filter for the configured atomic source, supported payload, matching intent and no provider error. Pin one source for the demo, preserving its ID during refresh. If the selected source disappears, fail visibly rather than choosing an unexpected route. A metadata change or schema mismatch disables execution; don't add permissive `any` casts until the wallet accepts it.

Ask the implementation agent to write a <=20-line integration note into STATUS after the live probe: actual selected source ID, available transaction type, approval format, known fee semantics and access result. Only research the selected provider's official documentation if needed to establish atomic settlement; no broad routing comparison.

The probe deliberately does not select or endorse a source. For the demo, prefer a conventional direct DEX/aggregator source with a documented same-transaction settlement path. Reject bridge-style sources even on Base-to-Base requests. Merely having an EVM transaction does not prove atomic delivery.

If only read-only quotes are available, keep review enabled and wallet execution disabled. If no key exists, retain simulation. Neither mode is a verified live swap. Do not introduce 0x, LI.FI or another second API as fallback during this deadline.
