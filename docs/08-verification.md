# Verification — September 29, 2026

Current scope: Arbitrum One, native ETH → native Circle USDC, same wallet. Supersedes initial Base/approval verification.

| Check | Result | Evidence |
|---|---|---|
| TypeScript | PASS | Explicit typecheck plus production build typecheck |
| Unit/boundary tests | PASS | 106 tests in three files |
| Production build | PASS | Next.js production build, all routes generated |
| Desktop/mobile browser | PASS | 1440px and 390px simulation lifecycle; screenshot inspection; no overflow/errors |
| Error/double submit | PASS | One request; recoverable retry/focus |
| Mocked wallet | PASS | Header disconnected → Ethereum → Arbitrum on wallet switch; Arbitrum ETH swap; one send; request body checked; reload resumes receipt without resending |
| HTTP boundary | PASS | Origin/Host, local hostname aliases, body size/schema, concurrency; real browser endpoint checks on localhost and 127.0.0.1 |
| Live model extraction | PASS | Nine cases; 4,998 input and 361 output tokens; includes bridge/Base rejection |
| Read-only Zerion probe | PASS | Real metadata/quote; strict normalization; native value; eth_call and gas estimate |
| Actual local quote endpoint | PASS | HTTP 200, chain 42161, kyber, executable payload for 0.001 ETH |
| Secret hygiene | PASS | Source/client-bundle scan; both envs and probe dump ignored |
| Owner signed transaction | NOT RUN | No agent signing/broadcast; extension and real receipt need owner |
| Safari/Firefox/screen reader | NOT RUN | Chrome checks only; no formal accessibility audit |

The local quote check caught an Origin validation bug that mocks did not cover. Next's internal Request URL differed from the expected local origin. Validation now checks exact browser Origin and Host against the configured local origin, without trusting forwarded headers. Regression tests cover acceptance and hostile Host rejection; real endpoint retest passed.

Read-only observation: wallet 0.001847241847681792 ETH. A 0.001 ETH quote estimated 2.685425 USDC, minimum 2.671997 USDC; 2x estimated gas reserve 0.000015540140644 ETH. Sufficient balance at check time; prices/fees may change. No live swap completion is claimed.

Official Kyber Arbitrum router and Zerion payload agree. Opaque calldata remains trusted provider input; this is not a security audit or proof of encoded recipient/minimum. Wallet review and a small demo cap remain necessary.

Live mode is running on http://127.0.0.1:3000; source kyber is pinned. Connect an installed desktop wallet to view balances. Keys remain in ignored envs. No push/deployment performed.

Latest visual revision: removed dividers and container outlines; circular blue send button with SVG arrow. Production build and five targeted browser checks passed; desktop/mobile screenshots inspected. Local aliases must match Origin/Host and the configured protocol/port; arbitrary origins remain rejected.

Wallet balance addition: ETH and native USDC on the connected Ethereum/Arbitrum network above the input. Queries are keyed by account/chain, refresh manually and after a successful swap, and show loading/error instead of fake zero. Build/typecheck, mocked wallet connection/network switch/balance/reload check, and real browser RPC access on both networks PASS. Actual extension consent and signing remain owner actions.
