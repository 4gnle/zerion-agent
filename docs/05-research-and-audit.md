# Research and feasibility audit

Prepared September 28, 2026. Primary sources were opened/read; the quote OpenAPI embedded in the official Markdown page was inspected because the rendered page hid child parameters. This is an audit of the **plan and documentation**, not a completed application security audit.

## Decision audit

| Earlier assumption / possible trap | Finding and resulting decision |
|---|---|
| A $20 subscription covers the app's AI | Codex account access and OpenAI API billing are separate. User subsequently authorized a small runtime API budget. One direct OpenAI extraction call is now the final design. |
| Need a general chatbot/agent framework | No. Extract a typed amount/pair once; implement all financial behavior in normal code. |
| Need several providers | No. OpenAI for language, Zerion for quotes, Base RPC for current balances/receipts. No fallback vendor. |
| Need to search every token symbol | Fixed Circle USDC and native ETH eliminate token ambiguity for this demo. Unsupported requests are rejected. |
| An API asset ID equals its Base address | Not a safe assumption. Resolve by chain implementation and use returned IDs. |
| Quote amount is in smallest units | Official contract uses a human-readable decimal string. Base units are internal only. |
| A quote always contains an executable transaction | No. Missing transaction/error means review-only, never wallet execution. |
| One sentence means one wallet popup | USDC may require approval then a swap. Show the two steps honestly. |
| Same chain implies instant atomic settlement | Not necessarily. Restrict to one verified atomic DEX/aggregator source; no bridge-style settlement. |
| A submitted hash is success | It is pending. Inspect receipt status, cancellations and replacement semantics. |
| Free API plan means free swap | API usage and network/provider/funding fees are distinct. No fixed gas estimate promised. |
| Free plan details are consistent everywhere | Zerion's older posts conflict on quotas. Current pricing surface takes precedence; dashboard/probe determines actual account access. |
| A new live demo is guaranteed in 1–2 days | Plausible with this scope, dependent on key access, installed wallet, route and funding. Timebox blockers and retain honest fallback. |
| “All edge cases” requires implementing everything | Relevant money-moving cases are guarded; all unsupported capabilities fail closed. Production hardening is out of scope. |

## Evidence register

Each summary is deliberately short. URLs are official primary references, not proof of user-specific access.

| ID | Source | Verified relevance |
|---|---|---|
| O1 | [Codex/ChatGPT pricing](https://learn.chatgpt.com/docs/pricing) | Plus includes Codex; account usage limits apply; dashboard/status exposes current allowance. |
| O2 | [Codex authentication](https://learn.chatgpt.com/docs/auth) | ChatGPT sign-in and API-key billing are different authentication/billing paths. |
| O3 | [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) | Responses, Structured Outputs, pinned snapshot and token pricing support the selected narrow extraction approach. |
| O4 | [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | SDK parse/Zod pattern; schema compliance still requires handling refusals/incomplete results. |
| Z1 | [Zerion API pricing surface](https://zerion.io/api) | Current Developer offer advertises $0, 2K requests/day and 3 RPS. Not a tested entitlement. |
| Z2 | [Zerion quickstart](https://developers.zerion.io/quickstart) | Dashboard key acquisition and read-only request workflow. |
| Z3 | [Zerion authentication](https://developers.zerion.io/authentication) | Basic Auth with key as username and blank password. |
| Z4 | [Swap quote contract](https://developers.zerion.io/api-reference/swap/get-swap-and-bridge-quotes) | Concrete request/response fields summarized in the adapter reference. |
| Z5 | [Asset implementation lookup](https://developers.zerion.io/api-reference/fungibles/get-fungible-asset-by-implementation) | Resolve native asset by chain, token by chain:address. |
| Z6 | [Rate limits](https://developers.zerion.io/rate-limits) | Throttling/error handling; avoid rapid polling or retry storms. |
| Z7 | [Zerion FAQ](https://zerion.io/blog/top-questions-about-zerion-api/) | Official February 2026 article says card verification for free access. Check actual signup rather than promising no card. |
| C1 | [Circle USDC contracts](https://developers.circle.com/stablecoins/usdc-contract-addresses) | Authoritative Base USDC contract; mainnet and testnet are distinct. |
| B1 | [Connect to Base](https://docs.base.org/get-started/connect-to-base) | Mainnet 8453, native ETH, public RPC and explorer. |
| B2 | [Base network fees](https://docs.base.org/base-chain/network-information/network-fees) | Gas isn't only a fixed L2 execution price; don't promise a penny cost. |
| W1 | [wagmi setup](https://wagmi.sh/react/getting-started) | wagmi/viem/TanStack Query provider setup; current docs include v3 migration. |
| W2 | [Injected connector](https://wagmi.sh/react/api/connectors/injected) | Injected EIP-1193/EIP-6963 connection avoids WalletConnect onboarding. |
| V1 | [viem receipt monitoring](https://viem.sh/docs/actions/public/waitForTransactionReceipt) | Receipt waiting, timeouts and transaction replacement handling. |
| V2 | [viem contract simulation](https://viem.sh/docs/contract/simulateContract) | Standard approval simulation before writing. |
| V3 | [viem gas estimation](https://viem.sh/docs/actions/public/estimateGas) | Estimate the actual transaction with its account. |
| E1 | [ERC-20 standard](https://eips.ethereum.org/EIPS/eip-20) | balanceOf, approve and allowance semantics. |
| N1 | [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) | Current baseline requirements; lock compatible dependencies rather than old snippets. |
| N2 | [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) | Same-origin server endpoints keep secrets off the client. |
| H1 | [Vercel Hobby](https://vercel.com/docs/plans/hobby) | Free personal/non-commercial tier exists, but localhost removes deployment work and exposure. |

The detailed quote schema can be fetched from the official page with `.md` appended if the HTML hides properties. Do not copy a whole documentation site into agent context. Inspect only fields needed for a concrete failure.

## Plan-level threat and reliability review

| Risk | Required control | Remaining limit |
|---|---|---|
| AI misreads sentence | Strict schema, deterministic scope/math validation, visible review | Semantic errors are still possible; schema is not truth. |
| Prompt injection | No tools/addresses/calldata from AI; fixed contracts/chain and user click | Not a formal model security proof. |
| Wrong token | Circle address allowlist; no ticker-only token lookup | Provider is still trusted for route encoding. |
| Overapproval | Decode standard approve; reconstruct exact amount | Approved spender remains a trust boundary. |
| Wrong/malicious swap data | Trusted HTTPS API, source pin, intent/tx checks, simulation, owner review | No full arbitrary-router ABI decoder or audit. |
| Stale amount/quote | Attempt ID, TTL, balance/account checks and requote after approval | Markets can move while wallet is open; slippage remains relevant. |
| Duplicated transaction | Synchronous lock; pending hash recovery; no auto-send retry | Ambiguous wallet broadcast may require manual explorer check. |
| Incorrect success | Atomic source, successful receipt, replacement checks | One inclusion is not finality; quoted output isn't measured output. |
| Cost abuse | Localhost, no public endpoints, small rate limits, no automatic paid retries | In-memory limits are not distributed or durable billing caps. |
| API/RPC outage | Bounded reads, useful errors, explicit simulation fallback | Live demo still depends on external infrastructure. |

## Scope deliberately excluded

No durable session service, distributed rate limiting, public production rollout, full calldata security audit, chain reorg/finality service, bridge tracking, arbitrary-token risk engine, all-wallet compatibility, mobile deep links, gas sponsorship, approval revocation UI or transaction replacement UI. Existing approval exposure is disclosed; revocation can be handled in the user's wallet if wanted. These are not quietly claimed as solved.

## What was and wasn't verified while preparing this kit

- VERIFIED: official documentation and concrete request fields; written plan reviewed for token/amount, approval, receipt and mode-boundary hazards.
- VERIFIED LOCALLY: the shipped probe's syntax and offline query construction, plus fixture/schema-document consistency checks. Final packaging validation is recorded by the preparer.
- NOT RUN: authenticated Zerion/OpenAI requests, RPC balances, selected route simulation, wallet signatures, live swap, app build or app browser tests. No keys were provided and no app exists yet.
- NOT PROMISED: universal token support, production safety, a live route for every balance, no gas fees, or enough remaining Codex allowance to finish uninterrupted.

The next agent must update the actual verification record as implementation proceeds. This document must never be presented as an independent smart-contract audit.
