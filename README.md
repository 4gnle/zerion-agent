# Wallet Agent

A minimal React + TypeScript agent interface: **“Swap half my ETH for USDC.”**

Two actions, same connected wallet: swap native ETH → native Circle USDC on Arbitrum, or bridge native ETH from Ethereum → Arbitrum. OpenAI extracts the instruction; deterministic code validates amounts; Zerion supplies the quote. The owner reviews and signs each action in their wallet. Native ETH requires no token approval.

<a href="https://zerion.io/"><img src="public/brand/zerion-lockup.svg" alt="Zerion" width="112" /></a>

Independent prototype · No affiliation claimed.

Task checklist and remaining manual verification: [TODO.md](TODO.md).

## Run locally

Node 22+ and npm. For a fresh setup, copy `.env.example` to `.env.local`, fill keys, then:

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Both 127.0.0.1 and localhost work on the configured port. Production preview: `npm run build` then `npm start`. The current workspace runs in live mode: connect an injected desktop wallet to open Your Balance to the right of the address for ETH and USDC balances. Use the network selector for Arbitrum or Ethereum. History on the left includes all indexed wallet networks, with Load older transactions. Existing workspace credentials are already in ignored `.env`/`.env.local`; do not overwrite them. Next.js prioritizes `.env.local`.

| Variable | Purpose |
|---|---|
| APP_MODE | simulation (default) or live; restart after changing |
| OPENAI_API_KEY | Server-only extraction; app API usage is billed separately |
| OPENAI_MODEL | gpt-4.1-mini-2025-04-14 by default |
| ZERION_API_KEY | Server-only metadata/quotes |
| DEMO_WALLET_ADDRESS | Public EOA address used only by read-only probes |
| ZERION_ATOMIC_SOURCE_ID | kyber, verified Arbitrum route |
| ZERION_BRIDGE_SOURCE_ID | lifi, verified Ethereum → Arbitrum reference route |
| APP_ORIGIN | Defaults to http://127.0.0.1:3000 |

Never provide or store a private key/seed phrase. Actual swaps use the connected wallet, not the probe address.

## Current behavior

- Half, whole percentages, or exact ETH amounts up to 18 decimals. Maximum 0.002 ETH per action; reject spending the full balance and require an estimated gas margin.
- Arbitrum native Circle USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`.
- Simulation uses 0.002 ETH; half produces an illustrative 2.7 USDC. Clearly labeled, with no executable payload/signatures. Without an OpenAI key, only fixture phrases work under Scripted simulation.
- Live route normalization, eth_call and gas estimation passed against the funded owner's Arbitrum wallet. No transaction was sent. Rates and gas are refreshed, not guaranteed.
- Quotes expire after 30 seconds; current account, chain, balance and preflight are checked before wallet confirmation. Pending receipts survive same-tab reload; uncertainty never triggers automatic resubmission.
- Native ETH needs no allowance. One explicit swap click leads to one wallet transaction request.

## Owner live check

1. Run `npm run probe` for a fresh read-only check. It quotes 0.001 ETH and never broadcasts.
2. Set APP_MODE=live in `.env.local`, retain ZERION_ATOMIC_SOURCE_ID=kyber, restart the local server.
3. Connect an ordinary injected desktop EOA with ETH on Arbitrum. Enter a small amount such as “Swap 0.001 ETH for USDC”.
4. Review the amount, minimum, recipient, route and fees. Confirm in your own wallet. No agent signs for you.
5. Check the Arbiscan receipt. Output remains labeled quoted unless independently measured. For unknown outcomes, check wallet activity before starting again.

Other/reverse bridges, Base, reverse swaps, WalletConnect, smart/delegated accounts and mobile wallet connection are outside scope. Mobile layout supports rehearsal.

## Bridge

Enter “Bridge 0.001 ETH from Ethereum to Arbitrum”. Ethereum must hold both the amount and gas; your existing Arbitrum ETH cannot fund that direction. The current owner quote reports insufficient Ethereum balance.

Zerion quotes the pinned LI.FI route. A funded public reference quote passed router/account/value normalization, eth_call and gas estimation; this is not an owner-signed bridge. After the Ethereum receipt, the app queries LI.FI status and verifies a successful destination receipt before showing Bridge complete. Use Check status or the transfer explorer while pending. Partial delivery, refunds and unknown outcomes are never labeled complete or automatically resent. Pending tracking survives reload.

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run test:browser # Local simulation preview and Chrome required
npm run probe       # Read-only external quote/preflight
npm run test:intent:live # Nine paid model calls; never part of routine tests
```

For the mocked live browser test against the current live preview: `TEST_LIVE_URL=http://127.0.0.1:3000 npm run test:browser -- tests/browser/live-mocked.spec.ts tests/browser/origin.spec.ts`. All wallet/RPC/history/status responses in the action-flow tests are mocked. For a separate server, use `APP_MODE=live APP_ORIGIN=http://127.0.0.1:3107 npm start -- --port 3107`, then target it with TEST_LIVE_URL. For simulation checks, start a temporary APP_MODE=simulation server and set TEST_BASE_URL to its origin. All wallet and RPC requests in this test are mocked.

See [verification](docs/08-verification.md) and [checkpoint](STATUS.md) for actual results and gaps. Real wallet signing, Safari/Firefox and screen-reader audit remain separate checks.

Next.js, React, TypeScript, plain CSS, wagmi, viem, TanStack Query, Zod and OpenAI SDK. No agent framework. Zerion Blue buttons/loading and official local logo; restrained neutral UI. Provider calldata remains trusted; validation and preflight are not a full security audit. Local throttles are not public production infrastructure.
