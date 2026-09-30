# Wallet Agent — TODO

Updated 2026-09-29. Keep this checklist current when implementation or verification changes. Latest owner decisions supersede the original Base-only brief.

## Completed

- [x] Next.js, React, TypeScript, CSS, wagmi/viem; server-only OpenAI and Zerion adapters.
- [x] Credentials stored in ignored environment files; no credentials in this document.
- [x] Wallet Agent naming; official local Zerion logo in Powered by footer.
- [x] Minimal UI, blue buttons/loading, improved circular send button; removed mode eyebrow entirely.
- [x] Injected wallet connection; Ethereum/Arbitrum selector and network-specific balances.
- [x] Your Balance dropdown to the right of address, with ETH/USDC and refresh/error states.
- [x] Left History section with pagination, refresh, pending transactions and unverified-token labels.
- [x] ETH → USDC swaps on Arbitrum; native ETH bridges Ethereum → Arbitrum, same wallet.
- [x] Deterministic amounts, 0.002 ETH cap, gas reserve, quote expiry and route validation.
- [x] Receipt recovery; bridge completion requires destination delivery, not only source confirmation.
- [x] Fixed localhost/127.0.0.1 request-origin mismatch.
- [x] Final screenshot-inspired polish: thin borders, rounded main/sidebar panels and nested cards; no new features.

## Verification already recorded

- [x] 125 unit/boundary tests; seven Chrome browser tests, including mocked swap/bridge and mobile flows.
- [x] Four live bridge extraction cases; earlier swap extraction checks. Do not rerun paid checks routinely.
- [x] Actual wallet history and balance reads; read-only swap quote/preflight.
- [x] Bridge reference-address quote/preflight; this does not verify an owner-funded bridge.
- [x] Provider not-indexed status remains pending; secret scan and ignored env files verified.
- [x] Final visual change: production build/typecheck and four targeted Chrome tests PASS. Desktop (1440px) and mobile (390px) screenshots inspected; no horizontal overflow, no live eyebrow.

## Remaining manual checks / known gaps

- [ ] Owner connects their real extension and reviews/signs a small swap, if desired; real owner receipt verification has not run.
- [ ] Owner must have ETH on Ethereum plus gas before testing Ethereum → Arbitrum bridging. Existing Arbitrum ETH cannot fund this direction. Last owner bridge quote was non-executable for insufficient Ethereum ETH.
- [ ] Verify a real bridge destination receipt after owner signing; never infer delivery from source inclusion.
- [ ] Safari/Firefox and screen-reader audit have not run.
- [ ] Record and review the interview demo; do not claim real execution when showing mocks or simulation.
- [ ] Publishing/pushing/deployment awaits an explicit owner request.

## Process log

- Established the narrow structured-intent flow and server-only integrations; later owner requests changed Base to Arbitrum and added the one-way Ethereum bridge.
- Added wallet connection, balance dropdown, changeable network and wallet transaction history; verified mocked lifecycle/recovery and read-only provider boundaries.
- Final design pass follows the supplied screenshot’s section framing while retaining the existing light palette, content and blue controls. Removed the complete live-mode eyebrow component and unused styles.

## Commands and handoff

`npm run build`, `npm run typecheck`, `npm test`.
Targeted live mock/origin checks: `TEST_LIVE_URL=http://127.0.0.1:3000 npm run test:browser -- tests/browser/live-mocked.spec.ts tests/browser/origin.spec.ts`.
Preview: `npm start` at http://127.0.0.1:3000. Detailed evidence: docs/08-verification.md. Current checkpoint: STATUS.md.
