# Current checkpoint

State: live wallet UI/history/bridge ready locally; owner signing NOT RUN.

Current owner scope:
- Wallet Agent; Powered by Zerion footer; neutral UI, blue buttons/loading, subtle rounded section panels.
- Network selector: Ethereum and Arbitrum only.
- Your Balance dropdown RIGHT of address; ETH and native USDC for connected chain.
- History on the left: all wallet networks, pagination, refresh, unverified/spam labeling.
- Swap ETH → USDC on Arbitrum; bridge native ETH Ethereum → Arbitrum, same wallet.
- One extraction call, deterministic wei math, 0.002 ETH cap, reserve gas; no approval.

Done:
- Final reference styling: framed History/main panels, softer cards; live eyebrow removed.
- TODO.md records completed work, verification and remaining owner checks.
- Live injected-wallet connection; native USDC contracts verified against Circle docs.
- Account/chain keyed balances/history, loading/error states, pending receipt recovery.
- Zerion metadata, quotes and history via server-only key; Origin/Host local aliases.
- Swap route kyber; bridge route lifi, official router allowlisted.
- Bridge status via LI.FI + successful Arbitrum receipt; Ethereum inclusion is not completion.
- Refund/partial/unknown outcomes remain tracked, never labeled complete or auto-resubmitted.
- Reference bridge payload normalized and eth_call/gas estimation PASS (117950 gas).
- Reference quote was for a public funded address, NOT the owner's wallet; no sends.
- Owner bridge quotes report insufficient Ethereum ETH; funding/gas is the live blocker.
- Both ignored env files remain APP_MODE=live; source pins kyber/lifi. No key exposure.

Verification:
- Final panel polish: build/typecheck + four targeted Chrome tests PASS; 1440/390px visual checks PASS.
- Build/typecheck PASS; 125 unit/boundary tests PASS.
- Seven browser checks PASS: live swap/bridge, header/history, localhost, desktop/mobile simulation.
- Four paid bridge extraction cases PASS (2,540 input + 154 output tokens).
- Actual history HTTP 200; owner bridge quote safely disabled for Ethereum funding.
- Bridge provider 404/1003 handled as pending indexing; real endpoint recheck PASS.
- Secret scan and git diff check PASS; env files ignored.
- Earlier actual wallet balance browser/RPC checks and localhost Origin checks PASS.
- Owner extension/signing/live receipt, Safari/Firefox and screen-reader audit NOT RUN.

Commands:
- npm run build; npm start (live preview http://127.0.0.1:3000).
- npm run typecheck; npm test
- TEST_LIVE_URL=http://127.0.0.1:3000 npm run test:browser -- tests/browser/live-mocked.spec.ts tests/browser/origin.spec.ts
- Simulation browser suite requires APP_MODE=simulation preview on port 3000.
- npm run probe (Arbitrum read-only); scripts/probe-ethereum-bridge.ts (read-only).
- npm run test:intent:live -- --bridge is paid; never run routinely.

Next:
- Owner connects wallet; Ethereum ETH + gas required for the requested bridge direction.
- No agent signatures/broadcast, commits/pushes or deployment; owner commit preserved.
