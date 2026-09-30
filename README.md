# Wallet Agent

A minimal conversational wallet interface built with Next.js, React, TypeScript and CSS. OpenAI extracts structured instructions; Zerion provides quotes and wallet history; wagmi and viem handle wallet interactions.

- Swap ETH and USDC on Ethereum, Arbitrum and Base.
- Bridge between these networks, with optional token conversion.
- Enter dollar values, percentages, or exact token amounts.
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
| `ZERION_ATOMIC_SOURCE_ID` | `kyber` for same-chain swaps |
| `ZERION_BRIDGE_SOURCE_ID` | `lifi` for the supported cross-chain routes |
| `DEMO_WALLET_ADDRESS` | Optional public wallet address for read-only probe scripts |
| `APP_ORIGIN` | Public HTTPS origin; defaults to the Vercel project domain, or localhost locally |

Keep API keys in ignored environment files. Never add private keys or seed phrases. Live mode requires API credentials and an injected desktop wallet. Simulation is labeled and does not move funds; without an OpenAI key it supports scripted examples.

## Usage

Try “Swap half my ETH for USDC” or “Bridge 0.001 ETH from Ethereum to Arbitrum”. Actions are capped at 0.002 ETH or 20 USDC and require remaining ETH for gas on the source network. The same wallet receives the output. Cross-chain completion requires verified delivery on the destination chain. Try “Bridge $2 of ETH from Arbitrum to Base then swap to USDC” for the combined route. Dollar inputs use a fresh input-token/USD price, exclude gas, and are rounded down to token base units. The input-token cap still applies, so larger dollar requests may be rejected.

This is a prototype, not audited production software. Provider transaction data is trusted; in-process request limits alone are not production abuse protection. WalletConnect and smart accounts are not supported.

## Public hosting

Set `APP_ORIGIN` to your public HTTPS origin (no path) if the Vercel project domain differs. API keys belong in server-side Vercel environment variables, never `NEXT_PUBLIC_*` variables.

Configure Vercel Firewall rate limits before setting `PUBLIC_API_ENABLED=true`. Suggested rules: `/api/` at 20 requests per minute per IP, plus a stricter `/api/intent` rule at 5 per minute per IP. Add a global intent limit if supported by your plan to bound distributed traffic. Vercel rate-limit pricing applies. No Redis is required. The app defaults to rejecting hosted API calls until enabled; this environment switch does not itself enforce a durable quota. The local in-memory limit supplements the firewall.

`API_ENABLED=false` pauses all API operations after redeployment. Keep provider spending limits and monitoring enabled; rate limits are not a guarantee of zero abuse or a fixed spending cap. Verify deployed firewall behavior and API responses before sharing the live link.

## Development

```bash
npm run typecheck
npm test
npm run build
npm start
```

Browser tests require Chrome and a running local preview. Run `npm run test:browser` against simulation mode; set `TEST_LIVE_URL` for the mocked live-flow tests. `TEST_BASE_URL` overrides the default preview URL. `npm run test:intent:live` makes separately billed OpenAI API calls.

The official Zerion logo is used for attribution. This project is independent of Zerion.

### Supported routes

Swap ETH ↔ native Circle USDC on Ethereum, Arbitrum or Base. Bridge ETH or USDC between any two of these networks, keeping the token or converting to the other token in the quoted route. A network named in “swap … on Base” applies to both sides; omitted source networks use the connected network. ARB tokens and other assets are not supported.

Examples: “swap 2 USDC from Base to Arbitrum”, “swap half my ETH for USDC on Base”, “bridge 0.001 ETH from Base to Ethereum”, “bridge $2 of ETH from Arbitrum to Base then swap to USDC”.

Execution remains limited to verified KyberSwap same-chain routes and LI.FI cross-chain routes returned by Zerion. Availability and minimum amounts vary; unsupported quotes stop without a signature. Input limits are 0.002 ETH or 20 USDC per action, plus source-network ETH for gas. USDC may require a separate exact-amount approval; after its receipt the app fetches a fresh quote and requires another explicit confirmation. Reloading during approval only checks its receipt and never sends the swap. Cross-chain completion requires verified destination delivery, with automatic status checks.
