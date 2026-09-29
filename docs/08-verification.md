# Verification — September 29, 2026

Current scope: Wallet Agent, Arbitrum ETH→USDC swap; native ETH bridge Ethereum→Arbitrum; same connected wallet. History covers all indexed wallet networks. Earlier Base/approval scope is superseded.

| Check | Result | Evidence |
|---|---|---|
| Build/typecheck | PASS | Production build; all six pages/routes generated |
| Unit/boundary checks | PASS | 125 tests in four files |
| Header and history | PASS | Balance dropdown right of address; Escape dismissal; Ethereum/Arbitrum selection; pagination |
| Mocked swap/bridge wallet | PASS | One explicit send each, source receipt and reload recovery; bridge awaits destination status |
| Browser suite | PASS | Seven tests including desktop/mobile simulation, errors, both local-origin endpoints and both live action flows |
| Responsive visuals | PASS | Desktop sidebar and mobile balance dropdown/history screenshots inspected |
| Bridge intent model | PASS | Four cases; 2,540 input and 154 output tokens; reverse/Base requests rejected |
| Live history endpoint | PASS | Owner wallet HTTP 200; two transactions, including an unverified token lookalike |
| Owner bridge quote | BLOCKED | Zerion lifi quote reports insufficient Ethereum ETH and contains no executable payload |
| Reference bridge preflight | PASS | Funded public reference address, not owner: official router, chain/value, eth_call and gas estimate (117950) |
| Owner signed execution | NOT RUN | No agent signed or broadcast; real extension/receipt needs owner |
| Safari/Firefox/screen-reader | NOT RUN | Chrome verification only |

The bridge route is quoted by Zerion and tracked through LI.FI's documented status endpoint. A completed source receipt is not bridge completion. Tests reject wrong source hash/account, destination chain/token/amount, partial delivery and refunds. A successful Arbitrum receipt is required before Bridge complete. Unknown transfers and provider errors retain recovery and never trigger a resend. Actual provider unknown-hash lookup returned 404/code 1003; handled as awaiting indexing; actual local endpoint retest returned HTTP 200 with complete=false.

ETH/USDC balances use RPC and allowlisted Circle contracts, with account/chain Query keys. History uses Zerion pagination without fetching provider-supplied URLs. Ticker lookalikes are marked unverified and never used for spendable balances. Keys stay server-side; no history or wallet address reaches OpenAI.

Local Origin validation permits matching Origin/Host on localhost or 127.0.0.1 at the configured protocol/port; arbitrary origins remain rejected. Real endpoint checks reach body validation without paid model calls.

The current live preview is http://127.0.0.1:3000. Ethereum needs transfer ETH plus gas for bridging; the owner's existing Arbitrum ETH cannot fund that direction. No funding purchase, deployment, push or agent transaction occurred. Provider calldata is still trusted; this is not a router/calldata security audit.

Source/client-bundle secret scan and git diff check PASS. Both credential files and probe payloads remain ignored.
