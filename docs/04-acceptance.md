# Acceptance checklist

Record honest PASS / FAIL / NOT RUN evidence in docs/08-verification.md. Current scope is Arbitrum native ETH → native USDC; historical Base/approval checks no longer apply.

- Intent fixtures: ready half/percentage/exact ETH; unsupported chain/bridge/assets/recipients, invalid precision, dollars, injection and missing fields. Model failure never reaches quoting.
- Amounts: wei precision, floor percentages, reject zero/cap/full balance, preserve gas reserve, invalidate changed relative balance.
- Quote: exact chain/assets/input, positive USDC minimum, slippage, router/source/value, no approval/bridge/unknown signing payload, missing or errored payload remains disabled.
- Transactions: no simulation signing; current account/chain/TTL checked before and after preflight; input plus gas margin funded; failure/cancellation/ambiguity never auto-retries.
- Receipt: success only after successful inclusion; cancellation/different replacement rejected, repricing followed, timeout retains hash, reload monitors without another send.
- HTTP: strict request, body limit, exact Origin, bounded concurrency, server-only keys and sanitized failures.
- UI: simple Wallet Agent branding, no eyebrows/composer description, Arbitrum and ETH→USDC visible, blue buttons/loading, accessible labels/focus/status, 390px layout without overflow.
- Build/typecheck and targeted unit/browser checks pass. Browser wallet is mocked; record real wallet/signing separately.
- Read-only Zerion/RPC probe verifies a funded executable route and preflight; never call this a live swap.
- Owner live smoke: owner reviews and signs a small exact amount, verifies Arbiscan receipt. Agent stops before signing/broadcasting.
