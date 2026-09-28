# Implementation contract

These are deliberate prototype design choices. Provider-specific field names live in `03-zerion-contract.md`; AI extraction lives in `07-intent-contract.md`.

## Minimal structure

Use Next.js App Router, TypeScript strict mode, ordinary CSS, wagmi, viem, TanStack Query, Zod and the OpenAI SDK. Vitest for logic; one small browser smoke suite if Playwright is available. No database, authentication service, LangChain, AI SDK framework, Zustand, XState, component library or animation package.

Suggested boundaries, not a mandate to create many empty files:

```text
app/page.tsx                  server mode/config -> client swap screen
app/api/intent/route.ts       one structured OpenAI extraction
app/api/quote/route.ts        validates input; server-only Zerion request
components/swap-screen.tsx    one reducer, input, review, wallet controls
components/providers.tsx     client wallet/query providers
lib/intent.ts                schema and semantic validation
lib/amounts.ts               BigInt calculations and formatting
lib/zerion.server.ts         asset resolution and quote normalization
lib/transactions.ts          guards, approval, receipt classification
lib/config.ts                fixed pair, cap, chain, slippage
lib/simulation.ts            isolated scripted wallet/quote adapter
```

Use a client boundary for wallet hooks and browser storage. No `window` access during SSR. Configure Base and injected-wallet discovery; show the installed connector names when more than one exists. Keep the QueryClient instance stable. No SIWE message, login or wallet ownership signature is needed.

## Amounts and authoritative balances

Constants: chain `8453`, Zerion chain `base`, USDC address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, USDC decimals `6`, native ETH decimals `18`, slippage `0.5%`, maximum sell `10_000_000n` USDC base units. Confirm USDC `decimals()` once on RPC and reject unexpected metadata. ETH has no ERC-20 contract; never substitute WETH or a guessed sentinel.

Read `balanceOf(account)` directly from the allowlisted USDC contract; read native ETH with the Base public client. Do not depend on indexed portfolio data for spendable balance. No portfolio endpoint is necessary for two assets.

- `half`: `balance / 2n`, floor.
- Integer percentage `p`: `balance * BigInt(p) / 100n`, floor, p in 1..100.
- Exact amount: strict decimal string, no sign/exponent/comma; reject >6 decimals BEFORE `parseUnits`. Keep all spend and comparison values as BigInt. Reject zero, excess balance and cap violations.
- Never use `Number`, `parseFloat`, formatted currency, or AI arithmetic to decide how much to spend. Number is acceptable for presentational fiat values only.
- Capture the balance and concrete amount when preparing the review. Refresh balance before each wallet request. If a relative balance changes, invalidate the review and ask the user to review a recomputed amount; never silently change the amount. If exact amount remains funded, keep it but update the displayed balance.

## Internal routes

Both routes: POST JSON, runtime Node, body <=2KB, Zod validation, exact configured Origin check, `Cache-Control: no-store`, no permissive CORS. Bind local development to `127.0.0.1`; no tunnel. Implement small in-process per-client throttles (intent: 10/minute, quote: 20/minute), one concurrent request per operation. This is sufficient for a local recording, not distributed abuse prevention. Do not deploy public live API routes in this scope.

`/api/intent`: `{text}` -> validated extraction or stable error code. No wallet address, balances or history sent to the model. See intent contract.

`/api/quote`: `{account, sellAmountBaseUnits}` -> normalized quote. Server independently validates an EVM address, digit-only positive amount <=10 USDC, fixed pair/chain, and checks current RPC USDC balance. Reject extra address/chain/route override fields. Derive from/to from account. Accept no arbitrary upstream URL or transaction supplied by the client. Fetch official HTTPS API only, set a 15-second timeout. Never expose either API key or return raw upstream error bodies.

Return a typed quote with server `requestId`, account, chain, sell base units, provider quote/source IDs, fetchedAt, validUntil, expected/minimum decimal ETH strings, fee details, approval requirements and validated transaction payload. BigInt travels as decimal strings. This envelope is app-internal, not Zerion's response shape.

Set app quote TTL to 30 seconds from fetch completion. It is a conservative UX policy, not a guarantee of upstream validity. No background quote polling. Manual refresh or step transition fetches a new quote. For 429, obey a bounded Retry-After, at most one retry for reads; never automatically retry wallet sending. Missing keys return a configuration error, not fabricated data.

## Reducer and race control

Use a discriminated union, not unrelated loading booleans:

`idle → interpreting → connecting/switching (if needed) → quoting → review → approvalSignature → approvalPending → quoting → review → swapSignature → swapPending → confirmed`.

Also allow `recoverableError`, `cancelled`, `unknownPending` and `invalidated`. Simulation uses the same visible states through a separate adapter. Parsing may precede wallet connection; preserve its result so connecting does not trigger another AI call.

- Each new sentence/Edit changes an attempt ID and invalidates quote/signing readiness. Abort obsolete read requests and discard late responses whose attempt/account/chain no longer matches.
- Wallet account changes, disconnects, or chain changes invalidate unsigned work immediately. Re-check actual wallet account and chain immediately before sending.
- A synchronous in-flight ref prevents double clicks before React rerenders. Disable Edit, input submission and mode changes while a wallet request or transaction is unresolved.
- After a tx hash exists, account/disconnect changes must not erase it. Monitor using its original account and Base chain. Never submit a replacement attempt automatically.
- Persist only the active transaction hash, chain, original account, stage and minimal quote summary in `sessionStorage`; restore receipt monitoring after same-tab refresh. No chat history, key or unsigned calldata persistence. Corrupt stored data is ignored. A record is not proof of payment.

## Approve, refresh, swap

Live execution uses only a verified, pinned synchronous atomic source identified from a real quote. Choose a conventional DEX/aggregator route that needs at most a standard ERC-20 allowance and one swap transaction. Source names in docs are not executable IDs. No bridge-style settlement, custom signatures, Permit2 signing, batch calls, paymasters or smart-account flow. If only unsupported routes exist, live execution is blocked; do not improvise a protocol.

1. Validate normalized quote: selected account; both chains Base; correct asset IDs; exact input amount; positive expected output; `0 < minimum <= expected`; exactly 0.5% slippage; no quote error; EVM payload; nonzero valid router; no unexpected transaction fields/format. Require native transaction value zero for this USDC sell prototype. If a source requires a positive extra native fee, reject that route.
2. Before enabling approval, decode its calldata with ERC-20 ABI. Require `approve(spender, amount)` on the allowlisted USDC contract, zero value, expected account/chain and a nonzero spender. Never treat router address as spender by assumption; they can differ. Read allowance for that spender.
3. If allowance is insufficient, encode your own standard approval for **exactly the sell amount**, retaining the provider-resolved spender. Never pass through an unlimited approval or opaque calldata. If this amount cannot cover the route, reject the route rather than silently increasing it. Simulate approval and handle false/revert. User clicks Allow USDC, then confirms in wallet. Wait for a successful approval receipt and re-read allowance.
4. Refetch the quote after approval, preserving amount, account, pair and chosen source. Revalidate. If it now needs a different spender, stop and show a new review; do not chain approvals in a loop. No more than one new approval per attempt.
5. Render the latest review. If minimum output, fees, source, amount or recipient change during a refresh, require a fresh click. There is no automatic swap following approval.
6. When user clicks Confirm swap, check TTL, balance, chain, account and allowance again. Perform a current RPC `call`/gas estimation with exact from/to/data/value. Simulate the swap only after required allowance is mined; preapproval simulation may legitimately fail. Block on revert or unknown estimation. Ensure sufficient native ETH for fees; do not attempt gas sponsorship.
7. Send through the connected wallet, never server signing. Set Base chain/account and validated `to/data/value`; let wallet/viem refresh nonce and fee settings. Never reuse the stale quote nonce after approval. Do not set conflicting legacy and EIP-1559 fees. If preflight consumed the remaining TTL, require refresh, not a send.
8. Save hash immediately, show pending, wait for receipt on Base. Success requires `receipt.status === 'success'` for the submitted atomic swap, not just a hash. One block inclusion is enough to say “confirmed” for this demo, not “finalized”. Refresh balances once afterward. Retain the quoted output label unless actual received output is independently verified.

Zerion and the pinned source remain trusted for opaque swap calldata. These checks are not a full router/calldata security audit or proof of recipient encoding. Do not claim they are. Exact allowances, a small funded demo wallet and owner wallet review limit exposure; they do not eliminate provider risk.

## Gas and unknown outcomes

USDC cannot pay gas in this ordinary EOA flow. User needs ETH on Base even though ETH is the output. Do not assume a fixed USD gas price. Base fees include L1-related cost as well as execution; use provider/wallet estimates and describe them as estimates. Before approval, check native balance against both estimated steps with a margin; if total estimation is unavailable, state that and let wallet provide the final cost rather than claiming a guaranteed total. Before swap, run fresh estimation and balance checks.

Use viem receipt replacement handling. A repriced identical transaction can continue under the replacement hash. A cancellation or different-payload replacement is not swap success. A 90-second polling timeout means unknown/pending, not failure. Offer bounded “Check status” and explorer link. A send error after a request may be ambiguous: if no hash is returned but broadcast cannot be ruled out, instruct the owner to check wallet activity before retrying. Never auto-send on retry, reload, reconnect or mount.

## Simulation and completion

Simulation uses 10 USDC plus simulated ETH; half is 5 USDC. Use fixture balances/quotes/receipts without valid broadcastable transactions. Hard-disable wallet send/sign methods at the adapter boundary. With an OpenAI key, AI interpretation may be live; otherwise only predefined fixture phrases work and the UI says Scripted simulation. Missing live keys must never silently select simulation after the page claims to be live.

Create scripts `dev`, `build`, `start`, `typecheck`, `test`, and `test:intent:live` (explicitly paid, never part of default tests). README must include env setup, local-only start and owner live-test steps. Do not add CI or hosting to the deadline.
