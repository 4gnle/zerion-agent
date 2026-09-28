# Focused acceptance and audit checklist

Run targeted verification once per meaningful change. No live transactions in automated tests. Do not treat this checklist as a completed audit. The implementation agent fills PASS / FAIL / NOT RUN with brief evidence in STATUS or a small results file.

## Automated logic checks — required

| Area | Cases / expected outcome |
|---|---|
| Intent | Mock all cases in `fixtures/intent-cases.json`; invalid or unsupported result never reaches quote API. |
| LLM errors | Refusal, incomplete, malformed parsed result, timeout, 401/429 => error, no quote/signing. |
| Scope validation | Wrong asset, network, external recipient or extra model fields rejected even if status says ready. |
| Amount math | Half of `10000001n` = `5000000n`; 25% = `2500000n`; half of `1n` = zero => block. |
| Exact precision | `0.000001` = 1 base unit; 7 decimals/exponent/negative/zero/comma => reject. |
| Cap/balance | Exact 10 USDC allowed if funded; >10 rejected; >balance rejected; no clamping. |
| Quote integrity | Wrong signer/chain/assets/input/slippage, bad hex, missing tx, provider error, zero minimum, nonzero native value => no signing. |
| Unsupported route | Unpinned, bridge-style, custom signature, smart-account or permit flow => no signing. |
| Approval | Wrong token, transfer selector, malformed data => reject. Unlimited quoted allowance is replaced with exact amount. Never assume spender = router. |
| Existing allowance | Enough allowance => no new approve; absent approval payload isn't permission to skip final swap preflight. |
| Requote | Receipt succeeds -> fresh quote; different spender -> stop for new attempt; no auto-swap. |
| Races | Double click sends once; late stale response discarded; wallet account/chain changed before send => block. |
| Lifecycle | Tx hash is pending only; reverted receipt fails; cancel replacement not success; repriced identical tx tracks new hash. |
| Recovery | Timeout/ambiguous broadcast cannot trigger auto-resend; refresh restores original hash monitoring. |
| Mode boundary | Simulation cannot access signing; a live error cannot become simulated success. |

Use one reducer/transaction-boundary integration test for the approval→refresh→swap sequence and one for account change while quoting. Mock RPC and wallet at adapter boundaries; do not mock every React hook individually. Money-handling guards deserve tests; static styling does not.

## Browser smoke — one pass

At 1440×1000 and 390×844, inspect input, quote, loading, error, wallet-request, pending and success states using deterministic adapters. Ensure all primary controls fit, addresses wrap, no console/hydration errors, Enter only submits text, focus is visible and screen-reader status messages update. Take local screenshots only as needed to diagnose layout. Do not add a screenshot suite for every state.

If browser tools are unavailable, run build/typecheck/tests and explicitly leave visual inspection NOT RUN with owner instructions. Do not claim a UI was inspected from code alone.

## Paid model smoke — once, capped

Run the 8 cases marked `liveSmoke:true`. Use the real server extraction function and compare structured fields/status, not natural-language phrasing. One request per case, sequential; no automatic retry or auto-tuning loop. Log aggregate pass/fail, usage totals and model ID; redact raw credentials. Fix a concrete mismatch once and rerun only affected cases. A prompt-injection test passing is not proof of comprehensive prompt-injection resistance.

## Owner live smoke — manual, mandatory to claim live success

1. Confirm the correct local origin and APP_MODE=live. Both API keys configured server-side. Run the read-only probe and select a verified atomic route source.
2. Use a small dedicated wallet on Base with native USDC and enough ETH for two transactions. Test once with a small exact amount; no automatic top-ups or asset purchases.
3. Connect; verify actual account/network. Submit the command and compare exact sell amount to the wallet balance, pair, recipient, minimum and fees.
4. Inspect allowance in the wallet request. Sign only if it matches the displayed amount/spender. Confirm the approval is mined before the next stage.
5. Inspect the refreshed quote and subsequent wallet transaction. Sign it manually. Verify successful Base receipt and balance update. Record hashes privately if desired.
6. Try wallet rejection once; confirm the app returns to a useful review state. Do not repeatedly transact merely to test cosmetic states.

Provider response validation, UI mocks and successful builds cannot replace this owner-signed test. If it is not completed, label live execution NOT RUN.

## Release gate

- `npm run typecheck`, `npm test`, `npm run build` pass using installed dependencies.
- No `.env.local` or API keys in Git, logs, client chunks or visible dev tools output.
- No `eth_sendTransaction` or signature request triggered by mount, an AI result, an effect or a retry.
- One scope, one page, no placeholder success, no obsolete unsupported feature promises.
- README says exactly which mode and provider functions have actually been verified.
- Record the demo; stop adding features.
