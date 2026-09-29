# Implementation contract

Current owner scope: native ETH → native Circle USDC on Arbitrum One (42161), same connected injected EOA. No bridge, token approval, permit, backend signer or second chain.

Next.js App Router, React, strict TypeScript, CSS, wagmi, viem, TanStack Query, Zod, OpenAI SDK. No database or agent framework. Wallet/browser storage stays behind the client boundary; QueryClient and wallet config remain stable.

## Amounts and quotes

Read native balance through Arbitrum RPC; verify the allowlisted native USDC contract's six decimals. ETH has 18 decimals. Use BigInt for spending and strict decimal parsing. Half and percentages floor to wei. Cap at 0.002 ETH. Reject zero, over-cap, over-balance and full-balance amounts. Never clamp. A changed relative balance invalidates the review; exact amounts may proceed only if still funded.

`POST /api/intent {text}` performs one structured extraction and validates it. `POST /api/quote {account,sellAmountBaseUnits}` uses wei (base units means units, not the Base network). The server independently checks cap and current ETH balance; from/to both use account. No client overrides for chain, assets, recipient or upstream URL. Keys remain server-only.

Both endpoints enforce matching Origin/Host with localhost and 127.0.0.1 aliases on the configured port, <=2KB JSON, strict schemas, sanitized errors, no-store responses, in-process throttles and one concurrent operation. Bind to 127.0.0.1. These are local demo controls, not production infrastructure.

The quote validates both chain/asset relationships, exact ETH input, six-decimal USDC output/minimum, 0.5% slippage, source kyber, official Arbitrum router and native value equal to input. Reject approvals, bridge fees, permits and unexpected signing payloads. TTL is 30 seconds; refresh is manual. Bounded read retry only, never retry sending automatically.

## Wallet lifecycle

`idle → interpreting → connecting if needed → quoting → review → swapSignature → swapPending → confirmed` with explicit error, invalidated, ambiguous and unknown-pending states.

Attempt IDs discard stale responses. Account/network changes invalidate unsigned work. In-flight refs prevent duplicate operations. After a hash exists, preserve and monitor its original account/chain even if the wallet disconnects. Session storage contains only the hash and minimal summary under an Arbitrum-specific key; no calldata or keys. Corrupt/old-chain records are ignored.

On the owner's explicit confirmation click, check actual wallet account/chain, TTL, current ETH balance and reviewed amount. Run `eth_call`, estimate gas and gas price with exact from/to/data/value. Require balance >= sell + 2 × estimated gas cost. Arbitrum's gas estimate accounts for L1 posting cost; the wallet supplies final nonce/fee settings. Recheck wallet and TTL after preflight, then request the one transaction.

Receipt success confirms inclusion, not finality or measured received USDC. Keep output labeled quoted. Repricing continues under its replacement hash; cancellation/different action does not count as swap success. A timeout retains pending state. Ambiguous wallet errors require checking activity. Never send on mount, reconnect, receipt polling or reload.

Zerion and Kyber remain trusted for opaque calldata, including encoded recipient and minimum. Router/value checks and preflight are not a calldata security audit. Owner wallet review remains necessary.

## Simulation

Simulation balance is 0.002 ETH; half is 0.001 ETH with an illustrative 2.7 USDC quote. Simulation has no executable payload and cannot cross the signing boundary. With an API key, interpretation is real; without one, fixture phrases work under a Scripted simulation label. Never silently turn a live failure into simulation.
