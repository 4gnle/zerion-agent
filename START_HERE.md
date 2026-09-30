# Continue Wallet Agent

Read AGENTS.md and STATUS.md first. Maintain TODO.md as the task and verification checklist. The owner's current scope is **Arbitrum ETH → native USDC swaps plus native ETH bridges from Ethereum to Arbitrum, same wallet**. This supersedes the earlier Arbitrum-only scope. The user also requested all-wallet transaction history on the left, a changeable Ethereum/Arbitrum selector and Your Balance dropdown to the right of the wallet address.

Keep Next.js + React + TypeScript, plain CSS, wagmi, viem, TanStack Query, Zod and OpenAI SDK. Keep the name Wallet Agent, minimal layout, no eyebrows or descriptive copy beneath the composer, and Zerion Blue buttons/loading.

One sentence → one structured extraction → deterministic amount validation → quote → explicit owner wallet confirmation → receipt. Native ETH input needs no token approval. Leave enough ETH for gas; do not silently shrink an amount. Cap each swap at 0.002 ETH. No reverse bridges or extra execution chains. Swaps require Arbitrum; bridges originate on Ethereum and require verified destination delivery before completion.

Read docs/01-product-and-design.md for UI, docs/02-implementation.md for application boundaries, docs/03-zerion-contract.md for the live adapter, and docs/07-intent-contract.md for extraction. Verification is recorded in docs/08-verification.md.

Credentials already exist in ignored env files; never print them. `.env.local` takes precedence. Run read-only live checks when necessary, but stop before signing or broadcasting. The owner signs in their installed desktop wallet.

Finish reversible local work, run typecheck/unit tests/build and targeted browser checks, update STATUS.md under 60 lines, and leave a local preview. Never describe mocks or preflight as a completed live swap. Do not publish, push or deploy without a request.
