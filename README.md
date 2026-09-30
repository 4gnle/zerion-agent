# Wallet Agent

A minimal conversational wallet interface built with Next.js, React, TypeScript and CSS. OpenAI extracts structured instructions; Zerion provides quotes and wallet history; wagmi and viem handle wallet interactions.

- Swap native ETH for USDC on Arbitrum.
- Bridge native ETH from Ethereum to Arbitrum.
- View ETH/USDC balances and wallet transaction history.
- Review quotes and confirm transactions in your connected desktop wallet.

## Run locally

Requires Node.js 22+ and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure `.env.local` before starting. Open http://127.0.0.1:3000.

| Variable | Purpose |
| --- | --- |
| `APP_MODE` | `simulation` (default) or `live` |
| `OPENAI_API_KEY` | Server-side intent extraction |
| `ZERION_API_KEY` | Server-side quotes and wallet history |
| `OPENAI_MODEL` | Model identifier; default provided in `.env.example` |
| `ZERION_ATOMIC_SOURCE_ID` | `kyber` for Arbitrum swaps |
| `ZERION_BRIDGE_SOURCE_ID` | `lifi` for Ethereum → Arbitrum bridges |
| `DEMO_WALLET_ADDRESS` | Optional public wallet address for read-only probe scripts |
| `APP_ORIGIN` | Local origin; defaults to `http://127.0.0.1:3000` |

Keep API keys in ignored environment files. Never add private keys or seed phrases. Live mode requires API credentials and an injected desktop wallet. Simulation is labeled and does not move funds; without an OpenAI key it supports scripted examples.

## Usage

Try “Swap half my ETH for USDC” or “Bridge 0.001 ETH from Ethereum to Arbitrum”. Actions are capped at 0.002 ETH and require remaining ETH for gas on the source network. The same wallet receives the output. Bridge completion requires confirmation on Arbitrum.

This is a prototype, not audited production software. Provider transaction data is trusted; local request limits are not production abuse protection. WalletConnect, smart accounts and reverse bridges are not supported.

## Development

```bash
npm run typecheck
npm test
npm run build
npm start
```

Browser tests require Chrome and a running local preview. Run `npm run test:browser` against simulation mode; set `TEST_LIVE_URL` for the mocked live-flow tests. `TEST_BASE_URL` overrides the default preview URL. `npm run test:intent:live` makes separately billed OpenAI API calls.

The official Zerion logo is used for attribution. This project is independent of Zerion.
